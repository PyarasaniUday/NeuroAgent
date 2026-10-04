/**
 * server.js — NeuroAgent Development Server
 * ==========================================
 *
 * Provides:
 * 1. EEG / NeuroAgent APIs
 * 2. EEG upload + pipeline execution
 * 3. Reports / visualization APIs
 * 4. Sign Up + Email OTP authentication
 * 5. Sign In + Email OTP authentication
 *
 * Authentication:
 * - Gmail SMTP through Nodemailer
 * - Password hashing with crypto.scryptSync
 * - Temporary in-memory OTP storage
 * - Temporary in-memory sessions
 *
 * NOTE:
 * EEG APIs remain unauthenticated so the existing n8n
 * NeuroAgent automation continues to work.
 */

'use strict';

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const PORT = 3000;

const PROJECT_ROOT = __dirname;
const DATA_DIR = path.join(PROJECT_ROOT, 'backend', 'data');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const METADATA_DIR = path.join(DATA_DIR, 'metadata');

// ========================================================
// AUTHENTICATION CONFIGURATION
// ========================================================

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// email -> OTP record
const otpStore = new Map();

// sessionToken -> session record
const sessions = new Map();

// Gmail SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ========================================================
// AUTH HELPERS
// ========================================================

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOTP() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString('hex');

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  try {
    const parts = String(storedPassword).split(':');

    if (parts.length !== 2) {
      return false;
    }

    const salt = parts[0];
    const storedHash = Buffer.from(parts[1], 'hex');

    const derivedHash = crypto.scryptSync(
      password,
      salt,
      64
    );

    if (storedHash.length !== derivedHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      storedHash,
      derivedHash
    );
  } catch (error) {
    return false;
  }
}

async function findUser(email) {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, password_hash, email_verified, created_at')
    .eq('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase findUser error:', error.message);
    return null;
  }

  return data;
}

async function createSupabaseUser(pendingUser) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: pendingUser.name || 'NeuroAgent User',
      email: normalizeEmail(pendingUser.email),
      password_hash: pendingUser.passwordHash,
      email_verified: true,
      created_at: pendingUser.createdAt || new Date().toISOString(),
    })
    .select('id, name, email, password_hash, email_verified, created_at')
    .single();

  if (error) {
    console.error('Supabase create user error:', error.message);
    throw new Error(error.message);
  }

  return data;
}

function createSession(res, email) {
  const token =
    generateSessionToken();

  sessions.set(token, {
    email: normalizeEmail(email),
    expiresAt:
      Date.now() + SESSION_EXPIRY_MS,
  });

  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(
      SESSION_EXPIRY_MS / 1000
    )}`
  );

  return token;
}

function getCookie(req, name) {
  const cookieHeader =
    req.headers.cookie || '';

  const cookies = cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const index = cookie.indexOf('=');

    if (index === -1) {
      continue;
    }

    const key = cookie.slice(0, index);
    const value = cookie.slice(index + 1);

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

async function getAuthenticatedUser(req) {
  const token =
    getCookie(req, 'session');

  if (!token) {
    return null;
  }

  const session =
    sessions.get(token);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  const user =
    await findUser(session.email);

  return {
    email: session.email,
    name:
      user?.name ||
      'NeuroAgent User',
  };
}

function clearSession(req, res) {
  const token =
    getCookie(req, 'session');

  if (token) {
    sessions.delete(token);
  }

  res.setHeader(
    'Set-Cookie',
    'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
  );
}

// ========================================================
// OTP EMAIL
// ========================================================

function sendOTP(email, code, purpose) {
  const subject =
    purpose === 'signup'
      ? 'NeuroAgent - Verify Your Account'
      : 'NeuroAgent - Sign In Verification Code';

  const message =
    purpose === 'signup'
      ? `
Welcome to NeuroAgent!

Your account verification OTP is:

${code}

This OTP will expire in 5 minutes.

If you did not request this, you can ignore this email.

NeuroAgent Team
`
      : `
Your NeuroAgent sign-in verification code is:

${code}

This OTP will expire in 5 minutes.

If you did not try to sign in, you can ignore this email.

NeuroAgent Team
`;

  return transporter.sendMail({
    from: `"NeuroAgent" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    text: message,
  });
}

async function createAndSendOTP(
  email,
  purpose,
  pendingUser = null
) {
  const normalizedEmail =
    normalizeEmail(email);

  const existing =
    otpStore.get(normalizedEmail);

  if (
    existing &&
    Date.now() - existing.createdAt <
      OTP_RESEND_MS
  ) {
    const remaining = Math.ceil(
      (
        OTP_RESEND_MS -
        (Date.now() - existing.createdAt)
      ) / 1000
    );

    return {
      success: false,
      error: `Please wait ${remaining} seconds before requesting another OTP.`,
    };
  }

  const code =
    generateOTP();

  otpStore.set(
    normalizedEmail,
    {
      code,
      purpose,
      createdAt: Date.now(),
      expiresAt:
        Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
      pendingUser,
    }
  );

  try {
    await sendOTP(
      normalizedEmail,
      code,
      purpose
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      'OTP email error:',
      error.message
    );

    otpStore.delete(
      normalizedEmail
    );

    return {
      success: false,
      error:
        'Unable to send OTP email. Please check the Gmail SMTP configuration.',
    };
  }
}

// ========================================================
// MIME TYPES
// ========================================================

const MIME = {
  '.html':
    'text/html; charset=utf-8',
  '.css':
    'text/css; charset=utf-8',
  '.js':
    'application/javascript; charset=utf-8',
  '.json':
    'application/json',
  '.png':
    'image/png',
  '.jpg':
    'image/jpeg',
  '.svg':
    'image/svg+xml',
  '.ico':
    'image/x-icon',
  '.woff2':
    'font/woff2',
};

// ========================================================
// CSV PARSER
// ========================================================

function parseCSV(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n');

  if (lines.length < 2) {
    return [];
  }

  const headers =
    splitCSVLine(lines[0]);

  return lines
    .slice(1)
    .map(line => {
      const vals =
        splitCSVLine(line);

      const obj = {};

      headers.forEach(
        (h, i) => {
          obj[h] =
            vals[i] !== undefined
              ? vals[i]
              : '';
        }
      );

      return obj;
    });
}

function splitCSVLine(line) {
  const result = [];

  let cur = '';
  let inQ = false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {
    const ch = line[i];

    if (ch === '"') {
      inQ = !inQ;
    } else if (
      ch === ',' &&
      !inQ
    ) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }

  result.push(cur.trim());

  return result;
}

function resolveCSVPath(
  routeKey,
  subject,
  recording
) {
  const baseMap = {
    '/api/neuroagent':
      'neuroagent.csv',
    '/api/iclabel':
      'iclabel.csv',
    '/api/fusion':
      'fusion.csv',
    '/api/psd':
      'psd.csv',
    '/api/alice':
      'alice.csv',
    '/api/quality':
      'quality_report.csv',
    '/api/features':
      'features.csv',
  };

  const suffix =
    baseMap[routeKey];

  if (!suffix) {
    return null;
  }

  const prefix =
    `${subject}${recording}`;

  const filename =
    `${prefix}_${suffix}`;

  const subPath =
    path.join(
      PROCESSED_DIR,
      subject,
      filename
    );

  if (fs.existsSync(subPath)) {
    return subPath;
  }

  const flatPath =
    path.join(
      PROCESSED_DIR,
      filename
    );

  if (fs.existsSync(flatPath)) {
    return flatPath;
  }

  return subPath;
}

function readCSVasJSON(fp, cb) {
  fs.readFile(
    fp,
    'utf8',
    (err, data) => {
      if (err) {
        return cb(
          {
            error:
              `File not found: ${path.basename(fp)}`,
            path: fp,
          },
          null
        );
      }

      try {
        cb(
          null,
          parseCSV(data)
        );
      } catch (e) {
        cb(
          {
            error: e.message,
          },
          null
        );
      }
    }
  );
}

// ========================================================
// SEND JSON
// ========================================================

function sendJSON(
  res,
  status,
  data
) {
  res.writeHead(
    status,
    {
      'Content-Type':
        'application/json',
    }
  );

  res.end(
    JSON.stringify(data)
  );
}

// ========================================================
// CSV ROUTES
// ========================================================

const CSV_ROUTES = {
  '/api/neuroagent': true,
  '/api/iclabel': true,
  '/api/fusion': true,
  '/api/psd': true,
  '/api/alice': true,
  '/api/quality': true,
  '/api/features': true,
};

// ========================================================
// HTTP SERVER
// ========================================================

const server =
  http.createServer(
    (req, res) => {

      // ----------------------------------------------------
      // CORS
      // ----------------------------------------------------

      const origin =
        req.headers.origin;

      if (
        origin ===
        FRONTEND_ORIGIN
      ) {
        res.setHeader(
          'Access-Control-Allow-Origin',
          FRONTEND_ORIGIN
        );

        res.setHeader(
          'Access-Control-Allow-Credentials',
          'true'
        );
      }

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,OPTIONS,POST'
      );

      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Filename'
      );

      if (
        req.method === 'OPTIONS'
      ) {
        res.writeHead(204);
        res.end();
        return;
      }

      const url =
        new URL(
          req.url,
          `http://localhost:${PORT}`
        );

      const pathname =
        url.pathname;

      // ====================================================
      // AUTH: SIGN UP
      // ====================================================

      if (
        req.method === 'POST' &&
        pathname ===
          '/api/auth/signup'
      ) {
        const chunks = [];

        req.on(
          'data',
          chunk =>
            chunks.push(chunk)
        );

        req.on(
          'end',
          async () => {

            let body = {};

            try {
              body =
                JSON.parse(
                  Buffer
                    .concat(chunks)
                    .toString('utf8')
                );
            } catch (error) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Invalid request body.',
                }
              );
              return;
            }

            const name =
              String(
                body.name || ''
              ).trim();

            const email =
              normalizeEmail(
                body.email
              );

            const password =
              String(
                body.password || ''
              );

            const confirmPassword =
              String(
                body.confirmPassword ||
                  ''
              );

            if (
              name.length < 2
            ) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Please enter your name.',
                }
              );
              return;
            }

            if (
              name.length > 50
            ) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Name must be 50 characters or less.',
                }
              );
              return;
            }

            if (
              !isValidEmail(email)
            ) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Please enter a valid email address.',
                }
              );
              return;
            }

            if (
              password.length < 8
            ) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Password must contain at least 8 characters.',
                }
              );
              return;
            }

            if (
              password !==
              confirmPassword
            ) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Passwords do not match.',
                }
              );
              return;
            }

            const existingUser =
              await findUser(email);

            if (existingUser) {
              sendJSON(
                res,
                409,
                {
                  error:
                    'An account with this email already exists.',
                }
              );
              return;
            }

            const pendingUser = {
              name,
              email,
              passwordHash:
                hashPassword(
                  password
                ),
              createdAt:
                new Date().toISOString(),
            };

            const result =
              await createAndSendOTP(
                email,
                'signup',
                pendingUser
              );

            if (
              !result.success
            ) {
              sendJSON(
                res,
                429,
                {
                  error:
                    result.error,
                }
              );
              return;
            }

            sendJSON(
              res,
              200,
              {
                success: true,
                message:
                  'OTP sent successfully.',
                email,
                purpose:
                  'signup',
              }
            );
          }
        );

        return;
      }

      // ====================================================
      // AUTH: SIGN IN
      // ====================================================

      if (
        req.method === 'POST' &&
        pathname ===
          '/api/auth/login'
      ) {
        const chunks = [];

        req.on(
          'data',
          chunk =>
            chunks.push(chunk)
        );

        req.on(
          'end',
          async () => {

            let body = {};

            try {
              body =
                JSON.parse(
                  Buffer
                    .concat(chunks)
                    .toString('utf8')
                );
            } catch (error) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Invalid request body.',
                }
              );
              return;
            }

            const email =
              normalizeEmail(
                body.email
              );

            const password =
              String(
                body.password || ''
              );

            const user =
              await findUser(email);

            if (
              !user ||
              !verifyPassword(
                password,
                user.password_hash
              )
            ) {
              sendJSON(
                res,
                401,
                {
                  error:
                    'Invalid email or password.',
                }
              );
              return;
            }

            const result =
              await createAndSendOTP(
                email,
                'signin'
              );

            if (
              !result.success
            ) {
              sendJSON(
                res,
                429,
                {
                  error:
                    result.error,
                }
              );
              return;
            }

            sendJSON(
              res,
              200,
              {
                success: true,
                message:
                  'OTP sent successfully.',
                email,
                purpose:
                  'signin',
              }
            );
          }
        );

        return;
      }

      // ====================================================
      // AUTH: VERIFY OTP
      // ====================================================

      if (
        req.method === 'POST' &&
        pathname ===
          '/api/auth/verify-otp'
      ) {
        const chunks = [];

        req.on(
          'data',
          chunk =>
            chunks.push(chunk)
        );

        req.on(
          'end',
          async () => {

            let body = {};

            try {
              body =
                JSON.parse(
                  Buffer
                    .concat(chunks)
                    .toString('utf8')
                );
            } catch (error) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Invalid request body.',
                }
              );
              return;
            }

            const email =
              normalizeEmail(
                body.email
              );

            const otp =
              String(
                body.otp || ''
              ).trim();

            const record =
              otpStore.get(email);

            if (!record) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'No active OTP found. Please request a new OTP.',
                }
              );
              return;
            }

            if (
              Date.now() >
              record.expiresAt
            ) {
              otpStore.delete(email);

              sendJSON(
                res,
                400,
                {
                  error:
                    'OTP has expired. Please request a new OTP.',
                }
              );
              return;
            }

            if (
              record.attempts >=
              MAX_OTP_ATTEMPTS
            ) {
              otpStore.delete(email);

              sendJSON(
                res,
                429,
                {
                  error:
                    'Too many incorrect attempts. Please request a new OTP.',
                }
              );
              return;
            }

            if (
              otp !== record.code
            ) {
              record.attempts++;

              sendJSON(
                res,
                400,
                {
                  error:
                    `Incorrect OTP. ${
                      MAX_OTP_ATTEMPTS -
                      record.attempts
                    } attempts remaining.`,
                }
              );
              return;
            }

            // OTP correct
            otpStore.delete(email);

            // ------------------------------------------------
            // SIGNUP
            // ------------------------------------------------

            if (
              record.purpose ===
              'signup'
            ) {
              const existingUser =
                await findUser(email);

              if (existingUser) {
                sendJSON(
                  res,
                  409,
                  {
                    error:
                      'Account already exists.',
                  }
                );
                return;
              }

              if (record.pendingUser) {
                try {
                  await createSupabaseUser(
                    record.pendingUser
                  );
                } catch (error) {
                  sendJSON(
                    res,
                    500,
                    {
                      error:
                        'Unable to create your account. Please try again.',
                    }
                  );
                  return;
                }
              }
            }

            // ------------------------------------------------
            // CREATE SESSION
            // ------------------------------------------------

            createSession(
              res,
              email
            );

            const authenticatedUser =
              await findUser(email);

            sendJSON(
              res,
              200,
              {
                success: true,
                message:
                  'OTP verified successfully.',
                authenticated:
                  true,
                email,
                name:
                  authenticatedUser?.name ||
                  'NeuroAgent User',
              }
            );
          }
        );

        return;
      }

      // ====================================================
      // AUTH: RESEND OTP
      // ====================================================

      if (
        req.method === 'POST' &&
        pathname ===
          '/api/auth/resend-otp'
      ) {
        const chunks = [];

        req.on(
          'data',
          chunk =>
            chunks.push(chunk)
        );

        req.on(
          'end',
          async () => {

            let body = {};

            try {
              body =
                JSON.parse(
                  Buffer
                    .concat(chunks)
                    .toString('utf8')
                );
            } catch (error) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Invalid request body.',
                }
              );
              return;
            }

            const email =
              normalizeEmail(
                body.email
              );

            const previous =
              otpStore.get(email);

            let purpose =
              body.purpose ||
              'signin';

            if (
              previous &&
              previous.purpose
            ) {
              purpose =
                previous.purpose;
            }

            let pendingUser =
              null;

            if (
              purpose ===
                'signup' &&
              previous
            ) {
              pendingUser =
                previous.pendingUser;
            }

            if (
              purpose ===
                'signin' &&
              !(await findUser(email))
            ) {
              sendJSON(
                res,
                400,
                {
                  error:
                    'Account not found.',
                }
              );
              return;
            }

            const result =
              await createAndSendOTP(
                email,
                purpose,
                pendingUser
              );

            if (
              !result.success
            ) {
              sendJSON(
                res,
                429,
                {
                  error:
                    result.error,
                }
              );
              return;
            }

            sendJSON(
              res,
              200,
              {
                success: true,
                message:
                  'A new OTP has been sent.',
              }
            );
          }
        );

        return;
      }

      // ====================================================
      // AUTH: STATUS
      // ====================================================

      if (
        req.method === 'GET' &&
        pathname ===
          '/api/auth/status'
      ) {
        getAuthenticatedUser(req)
          .then(user => {
            if (!user) {
              sendJSON(
                res,
                200,
                {
                  authenticated: false,
                }
              );
              return;
            }

            sendJSON(
              res,
              200,
              {
                authenticated: true,
                email: user.email,
                name: user.name,
              }
            );
          })
          .catch(error => {
            console.error('Auth status error:', error.message);
            sendJSON(
              res,
              500,
              {
                authenticated: false,
                error: 'Unable to check authentication status.',
              }
            );
          });

        return;
      }

      // ====================================================
      // AUTH: LOGOUT
      // ====================================================

      if (
        req.method === 'POST' &&
        pathname ===
          '/api/auth/logout'
      ) {
        clearSession(
          req,
          res
        );

        sendJSON(
          res,
          200,
          {
            success: true,
          }
        );

        return;
      }

      // ====================================================
      // DEFAULT EEG PARAMETERS
      // ====================================================

      let subject =
        (
          url.searchParams.get(
            'subject'
          ) || 'S002'
        ).toUpperCase();

      let recording =
        (
          url.searchParams.get(
            'recording'
          ) || 'R01'
        ).toUpperCase();

      const session =
        url.searchParams.get(
          'session'
        );

      if (session) {
        const m =
          session.match(
            /^(S\d{3})(R\d{2})$/i
          );

        if (m) {
          subject =
            m[1].toUpperCase();

          recording =
            m[2].toUpperCase();
        }
      }

      // ====================================================
      // CSV API ROUTES
      // ====================================================

      if (
        CSV_ROUTES[pathname]
      ) {
        const csvPath =
          resolveCSVPath(
            pathname,
            subject,
            recording
          );

        readCSVasJSON(
          csvPath,
          (err, data) => {
            if (err) {
              sendJSON(
                res,
                404,
                err
              );
            } else {
              sendJSON(
                res,
                200,
                data
              );
            }
          }
        );

        return;
      }

      // ====================================================
      // /api/subjects
      // ====================================================

      if (
        pathname ===
        '/api/subjects'
      ) {
        const subjects =
          new Set();

        if (
          fs.existsSync(
            PROCESSED_DIR
          )
        ) {
          fs.readdirSync(
            PROCESSED_DIR
          ).forEach(
            item => {
              if (
                /^S\d{3}$/i.test(
                  item
                )
              ) {
                subjects.add(
                  item.toUpperCase()
                );
              }
            }
          );
        }

        subjects.add('S002');

        sendJSON(
          res,
          200,
          {
            subjects:
              Array.from(
                subjects
              ).sort(),
          }
        );

        return;
      }

      // ====================================================
      // /api/recordings
      // ====================================================

      if (
        pathname ===
        '/api/recordings'
      ) {
        const recs =
          new Set();

        const subjDir =
          path.join(
            PROCESSED_DIR,
            subject
          );

        if (
          fs.existsSync(subjDir)
        ) {
          fs.readdirSync(
            subjDir
          ).forEach(
            f => {
              const m =
                f.match(
                  /R\d{2}/i
                );

              if (m) {
                recs.add(
                  m[0].toUpperCase()
                );
              }
            }
          );
        }

        if (
          subject === 'S002'
        ) {
          recs.add('R01');
        }

        sendJSON(
          res,
          200,
          {
            subject,
            recordings:
              Array.from(
                recs
              ).sort(),
          }
        );

        return;
      }

      // ====================================================
      // /api/manifest
      // ====================================================

      if (
        pathname ===
        '/api/manifest'
      ) {
        const manifestPath =
          path.join(
            METADATA_DIR,
            'dataset_manifest.csv'
          );

        if (
          !fs.existsSync(
            manifestPath
          )
        ) {
          sendJSON(
            res,
            404,
            {
              error:
                'dataset_manifest.csv not found',
            }
          );

          return;
        }

        readCSVasJSON(
          manifestPath,
          (err, data) => {
            if (err) {
              sendJSON(
                res,
                500,
                err
              );
            } else {
              sendJSON(
                res,
                200,
                data
              );
            }
          }
        );

        return;
      }

      // ====================================================
      // /api/upload
      // ====================================================

      if (
        req.method === 'POST' &&
        pathname ===
          '/api/upload'
      ) {
        const uploadDir =
          path.join(
            DATA_DIR,
            'raw',
            'uploads'
          );

        if (
          !fs.existsSync(
            uploadDir
          )
        ) {
          fs.mkdirSync(
            uploadDir,
            {
              recursive: true,
            }
          );
        }

        const rawFilename =
          req.headers[
            'x-filename'
          ] || '';

        const contentType =
          req.headers[
            'content-type'
          ] || '';

        if (rawFilename) {
          const filename =
            path.basename(
              decodeURIComponent(
                rawFilename
              )
            );

          const targetPath =
            path.join(
              uploadDir,
              filename
            );

          const ws =
            fs.createWriteStream(
              targetPath
            );

          req.pipe(ws);

          ws.on(
            'finish',
            () => {
              let subj =
                'S002';

              let rec =
                'R01';

              const m =
                filename.match(
                  /^(S\d{3})(R\d{2})/i
                );

              if (m) {
                subj =
                  m[1].toUpperCase();

                rec =
                  m[2].toUpperCase();
              }

              sendJSON(
                res,
                200,
                {
                  success:
                    true,
                  filename,
                  filePath:
                    targetPath,
                  subject:
                    subj,
                  recording:
                    rec,
                }
              );
            }
          );

          ws.on(
            'error',
            err =>
              sendJSON(
                res,
                500,
                {
                  error:
                    err.message,
                }
              )
          );

          return;
        }

        const chunks = [];

        req.on(
          'data',
          c =>
            chunks.push(c)
        );

        req.on(
          'end',
          () => {
            const buffer =
              Buffer.concat(
                chunks
              );

            let filename =
              'uploaded_eeg.edf';

            const strHead =
              buffer
                .slice(
                  0,
                  2048
                )
                .toString(
                  'binary'
                );

            const fnMatch =
              strHead.match(
                /filename="([^"]+)"/i
              );

            if (fnMatch) {
              filename =
                path.basename(
                  fnMatch[1]
                );
            }

            let fileData =
              buffer;

            const boundaryMatch =
              contentType.match(
                /boundary=(?:"([^"]+)"|([^;]+))/i
              );

            if (
              boundaryMatch
            ) {
              const boundary =
                boundaryMatch[1] ||
                boundaryMatch[2];

              const headerEnd =
                buffer.indexOf(
                  Buffer.from(
                    '\r\n\r\n'
                  )
                );

              const footerStart =
                buffer.lastIndexOf(
                  Buffer.from(
                    `\r\n--${boundary}`
                  )
                );

              if (
                headerEnd !== -1 &&
                footerStart !== -1 &&
                footerStart >
                  headerEnd + 4
              ) {
                fileData =
                  buffer.slice(
                    headerEnd + 4,
                    footerStart
                  );
              }
            }

            const targetPath =
              path.join(
                uploadDir,
                filename
              );

            fs.writeFileSync(
              targetPath,
              fileData
            );

            let subj =
              'S002';

            let rec =
              'R01';

            const m =
              filename.match(
                /^(S\d{3})(R\d{2})/i
              );

            if (m) {
              subj =
                m[1].toUpperCase();

              rec =
                m[2].toUpperCase();
            }

            sendJSON(
              res,
              200,
              {
                success:
                  true,
                filename,
                filePath:
                  targetPath,
                subject:
                  subj,
                recording:
                  rec,
              }
            );
          }
        );

        return;
      }

      // ====================================================
      // /api/run-analysis
      // ====================================================

      if (
        req.method === 'POST' &&
        pathname ===
          '/api/run-analysis'
      ) {
        const chunks = [];

        req.on(
          'data',
          c =>
            chunks.push(c)
        );

        req.on(
          'end',
          () => {
            let body = {};

            try {
              body =
                JSON.parse(
                  Buffer
                    .concat(chunks)
                    .toString(
                      'utf8'
                    )
                );
            } catch (e) {
              body = {};
            }

            const filename =
              body.filename ||
              `${subject}${recording}.edf`;

            let subj =
              body.subject ||
              subject ||
              'S002';

            let rec =
              body.recording ||
              recording ||
              'R01';

            const m =
              filename.match(
                /^(S\d{3})(R\d{2})/i
              );

            if (m) {
              subj =
                m[1].toUpperCase();

              rec =
                m[2].toUpperCase();
            }

            let edfPath =
              path.join(
                DATA_DIR,
                'raw',
                'uploads',
                filename
              );

            if (
              !fs.existsSync(
                edfPath
              )
            ) {
              edfPath =
                path.join(
                  DATA_DIR,
                  'raw',
                  'EEGc',
                  subj,
                  filename
                );
            }

            if (
              !fs.existsSync(
                edfPath
              )
            ) {
              edfPath =
                path.join(
                  DATA_DIR,
                  'raw',
                  'EEGc',
                  subj,
                  `${subj}${rec}.edf`
                );
            }

            const pyRunner =
              path.join(
                PROJECT_ROOT,
                'backend',
                'src',
                'pipeline_runner.py'
              );

            const pyArgs = [
              pyRunner,
              '--subject',
              subj,
              '--recording',
              rec,
            ];

            if (
              fs.existsSync(
                edfPath
              )
            ) {
              pyArgs.push(
                '--edf',
                edfPath
              );
            }

            if (body.force) {
              pyArgs.push(
                '--force'
              );
            }

            const py =
              spawn(
                'python',
                pyArgs
              );

            let out = '';
            let err = '';

            py.stdout.on(
              'data',
              d => {
                out += d;
              }
            );

            py.stderr.on(
              'data',
              d => {
                err += d;
              }
            );

            py.on(
              'close',
              code => {

                const helperPath =
                  path.join(
                    PROJECT_ROOT,
                    'api_helper.py'
                  );

                const sessPy =
                  spawn(
                    'python',
                    [
                      helperPath,
                      '--subject',
                      subj,
                      '--recording',
                      rec,
                      '--file',
                      'session',
                    ]
                  );

                let sOut = '';

                sessPy.stdout.on(
                  'data',
                  d => {
                    sOut += d;
                  }
                );

                sessPy.on(
                  'close',
                  () => {

                    let sessionData =
                      null;

                    try {
                      sessionData =
                        JSON.parse(
                          sOut
                        );
                    } catch (e) {}

                    if (
                      !sessionData
                    ) {
                      sessionData = {
                        session_id:
                          `${subj}${rec}`,
                        subject:
                          subj,
                        recording:
                          filename,
                        channels:
                          64,
                        sampling_rate:
                          160,
                        duration:
                          60.99,
                        ica_components:
                          63,
                      };
                    }

                    sendJSON(
                      res,
                      200,
                      {
                        success:
                          code === 0,
                        subject:
                          subj,
                        recording:
                          rec,
                        filename,
                        session:
                          sessionData,
                        pipeline_output:
                          out
                            .trim()
                            .split(
                              '\n'
                            )
                            .pop(),
                      }
                    );
                  }
                );
              }
            );
          }
        );

        return;
      }

      // ====================================================
      // /api/session
      // ====================================================

      if (
        pathname ===
        '/api/session'
      ) {
        const prefix =
          `${subject}${recording}`;

        const files = {};

        const baseNames = [
          'neuroagent.csv',
          'iclabel.csv',
          'fusion.csv',
          'psd.csv',
          'alice.csv',
          'quality_report.csv',
          'features.csv',
        ];

        baseNames.forEach(
          bn => {
            const p1 =
              path.join(
                PROCESSED_DIR,
                subject,
                `${prefix}_${bn}`
              );

            const p2 =
              path.join(
                PROCESSED_DIR,
                `${prefix}_${bn}`
              );

            files[bn] =
              fs.existsSync(p1) ||
              fs.existsSync(p2);
          }
        );

        [
          'preprocessed_raw.fif',
          'reconstructed_raw.fif',
          'ica.fif',
        ].forEach(
          fif => {
            const p1 =
              path.join(
                PROCESSED_DIR,
                subject,
                `${prefix}_${fif}`
              );

            const p2 =
              path.join(
                PROCESSED_DIR,
                `${prefix}_${fif}`
              );

            files[fif] =
              fs.existsSync(p1) ||
              fs.existsSync(p2);
          }
        );

        const helperPath =
          path.join(
            PROJECT_ROOT,
            'api_helper.py'
          );

        const py =
          spawn(
            'python',
            [
              helperPath,
              '--subject',
              subject,
              '--recording',
              recording,
              '--file',
              'session',
            ]
          );

        let out = '';

        py.stdout.on(
          'data',
          d => {
            out += d;
          }
        );

        py.on(
          'close',
          code => {

            if (code === 0) {
              try {
                const parsed =
                  JSON.parse(
                    out
                  );

                parsed.files =
                  files;

                sendJSON(
                  res,
                  200,
                  parsed
                );

                return;
              } catch (e) {}
            }

            sendJSON(
              res,
              200,
              {
                session_id:
                  prefix,
                subject,
                recording:
                  `${prefix}.edf`,
                channels:
                  64,
                sampling_rate:
                  160,
                duration:
                  60.99,
                ica_components:
                  63,
                files,
              }
            );
          }
        );

        return;
      }

      // ====================================================
      // REPORTS
      // ====================================================

      if (
        pathname ===
        '/api/reports/metrics'
      ) {
        const metricsPath =
          path.join(
            DATA_DIR,
            'reports',
            'training_metrics.json'
          );

        if (
          fs.existsSync(
            metricsPath
          )
        ) {
          try {
            const d =
              JSON.parse(
                fs.readFileSync(
                  metricsPath,
                  'utf8'
                )
              );

            sendJSON(
              res,
              200,
              d
            );
          } catch (e) {
            sendJSON(
              res,
              500,
              {
                error:
                  e.message,
              }
            );
          }
        } else {
          sendJSON(
            res,
            404,
            {
              error:
                'training_metrics.json not found',
            }
          );
        }

        return;
      }

      if (
        pathname ===
        '/api/reports/dataset'
      ) {
        const dsPath =
          path.join(
            DATA_DIR,
            'reports',
            'final_dataset_report.json'
          );

        if (
          fs.existsSync(dsPath)
        ) {
          try {
            const d =
              JSON.parse(
                fs.readFileSync(
                  dsPath,
                  'utf8'
                )
              );

            sendJSON(
              res,
              200,
              d
            );
          } catch (e) {
            sendJSON(
              res,
              500,
              {
                error:
                  e.message,
              }
            );
          }
        } else {
          sendJSON(
            res,
            404,
            {
              error:
                'final_dataset_report.json not found',
            }
          );
        }

        return;
      }

      if (
        pathname ===
        '/api/reports/confusion-matrix'
      ) {
        const imgPath =
          path.join(
            DATA_DIR,
            'reports',
            'confusion_matrix.png'
          );

        if (
          fs.existsSync(
            imgPath
          )
        ) {
          res.writeHead(
            200,
            {
              'Content-Type':
                'image/png',
            }
          );

          fs
            .createReadStream(
              imgPath
            )
            .pipe(res);
        } else {
          res.writeHead(
            404,
            {
              'Content-Type':
                'text/plain',
            }
          );

          res.end(
            'confusion_matrix.png not found'
          );
        }

        return;
      }

      // ====================================================
      // /api/topomap
      // ====================================================

      if (
        pathname ===
        '/api/topomap'
      ) {
        const helperPath =
          path.join(
            PROJECT_ROOT,
            'api_helper.py'
          );

        const comp =
          url.searchParams.get(
            'component'
          ) ||
          url.searchParams.get(
            'ic'
          ) ||
          'IC1';

        const py =
          spawn(
            'python',
            [
              helperPath,
              '--subject',
              subject,
              '--recording',
              recording,
              '--file',
              'topomap',
              '--component',
              comp,
            ]
          );

        let out = '';
        let err = '';

        py.stdout.on(
          'data',
          d => {
            out += d;
          }
        );

        py.stderr.on(
          'data',
          d => {
            err += d;
          }
        );

        py.on(
          'close',
          code => {
            if (code !== 0) {
              sendJSON(
                res,
                500,
                {
                  error:
                    'Topomap helper failed',
                  details:
                    err,
                }
              );
            } else {
              try {
                sendJSON(
                  res,
                  200,
                  JSON.parse(out)
                );
              } catch (e) {
                sendJSON(
                  res,
                  500,
                  {
                    error:
                      'Invalid JSON from topomap helper',
                    raw:
                      out.slice(
                        0,
                        200
                      ),
                  }
                );
              }
            }
          }
        );

        return;
      }

      // ====================================================
      // /api/channel-compare
      // ====================================================

      if (
        pathname ===
        '/api/channel-compare'
      ) {
        const helperPath =
          path.join(
            PROJECT_ROOT,
            'api_helper.py'
          );

        const channel =
          url.searchParams.get(
            'channel'
          ) || 'F7';

        const samples =
          url.searchParams.get(
            'samples'
          ) || '600';

        const py =
          spawn(
            'python',
            [
              helperPath,
              '--subject',
              subject,
              '--recording',
              recording,
              '--file',
              'compare',
              '--channel',
              channel,
              '--samples',
              samples,
            ]
          );

        let out = '';
        let err = '';

        py.stdout.on(
          'data',
          d => {
            out += d;
          }
        );

        py.stderr.on(
          'data',
          d => {
            err += d;
          }
        );

        py.on(
          'close',
          code => {
            if (code !== 0) {
              sendJSON(
                res,
                500,
                {
                  error:
                    'Channel compare helper failed',
                  details:
                    err,
                }
              );
            } else {
              try {
                sendJSON(
                  res,
                  200,
                  JSON.parse(out)
                );
              } catch (e) {
                sendJSON(
                  res,
                  500,
                  {
                    error:
                      'Invalid JSON from compare helper',
                    raw:
                      out.slice(
                        0,
                        200
                      ),
                  }
                );
              }
            }
          }
        );

        return;
      }

      // ====================================================
      // /api/channels
      // ====================================================

      if (
        pathname ===
        '/api/channels'
      ) {
        const helperPath =
          path.join(
            PROJECT_ROOT,
            'api_helper.py'
          );

        const py =
          spawn(
            'python',
            [
              helperPath,
              '--subject',
              subject,
              '--recording',
              recording,
              '--file',
              'channels',
            ]
          );

        let out = '';
        let err = '';

        py.stdout.on(
          'data',
          d => {
            out += d;
          }
        );

        py.stderr.on(
          'data',
          d => {
            err += d;
          }
        );

        py.on(
          'close',
          code => {
            if (code !== 0) {
              sendJSON(
                res,
                500,
                {
                  error:
                    'Channels helper failed',
                  details:
                    err,
                }
              );
            } else {
              try {
                sendJSON(
                  res,
                  200,
                  JSON.parse(out)
                );
              } catch (e) {
                sendJSON(
                  res,
                  500,
                  {
                    error:
                      'Invalid JSON from channels helper',
                    raw:
                      out.slice(
                        0,
                        200
                      ),
                  }
                );
              }
            }
          }
        );

        return;
      }

      // ====================================================
      // /api/eeg-samples
      // ====================================================

      if (
        pathname ===
        '/api/eeg-samples'
      ) {
        const helperPath =
          path.join(
            PROJECT_ROOT,
            'api_helper.py'
          );

        if (
          !fs.existsSync(
            helperPath
          )
        ) {
          sendJSON(
            res,
            503,
            {
              error:
                'api_helper.py not found',
              available:
                false,
            }
          );

          return;
        }

        const fileType =
          url.searchParams.get(
            'file'
          ) ||
          'preprocessed';

        const component =
          url.searchParams.get(
            'ic'
          ) ||
          url.searchParams.get(
            'component'
          ) ||
          'IC1';

        const samples =
          url.searchParams.get(
            'samples'
          ) ||
          '800';

        const channels =
          url.searchParams.get(
            'channels'
          ) ||
          '0,1,2,3,4,5,6,7';

        const py =
          spawn(
            'python',
            [
              helperPath,
              '--subject',
              subject,
              '--recording',
              recording,
              '--file',
              fileType,
              '--component',
              component,
              '--samples',
              samples,
              '--channels',
              channels,
            ]
          );

        let out = '';
        let err = '';

        py.stdout.on(
          'data',
          d => {
            out += d;
          }
        );

        py.stderr.on(
          'data',
          d => {
            err += d;
          }
        );

        py.on(
          'close',
          code => {
            if (code !== 0) {
              sendJSON(
                res,
                500,
                {
                  error:
                    'Python helper failed',
                  details:
                    err,
                }
              );
            } else {
              try {
                sendJSON(
                  res,
                  200,
                  JSON.parse(out)
                );
              } catch (e) {
                sendJSON(
                  res,
                  500,
                  {
                    error:
                      'Invalid JSON from helper',
                    raw:
                      out.slice(
                        0,
                        200
                      ),
                  }
                );
              }
            }
          }
        );

        return;
      }

      // ====================================================
      // STATIC FILE SERVING
      // ====================================================

      const distDir =
        path.join(
          PROJECT_ROOT,
          'dist'
        );

      let relPath =
        pathname === '/'
          ? '/index.html'
          : pathname;

      let targetPath =
        path.join(
          distDir,
          relPath
        );

      if (
        !fs.existsSync(
          targetPath
        )
      ) {
        targetPath =
          path.join(
            PROJECT_ROOT,
            relPath
          );
      }

      if (
        !fs.existsSync(
          targetPath
        ) &&
        !path.extname(
          relPath
        )
      ) {
        if (
          fs.existsSync(
            path.join(
              distDir,
              'index.html'
            )
          )
        ) {
          targetPath =
            path.join(
              distDir,
              'index.html'
            );
        } else {
          targetPath =
            path.join(
              PROJECT_ROOT,
              'index.html'
            );
        }
      }

      fs.readFile(
        targetPath,
        (err, data) => {
          if (err) {
            res.writeHead(
              404,
              {
                'Content-Type':
                  'text/plain',
              }
            );

            res.end(
              `404 — ${pathname}`
            );

            return;
          }

          const ext =
            path
              .extname(
                targetPath
              )
              .toLowerCase();

          res.writeHead(
            200,
            {
              'Content-Type':
                MIME[ext] ||
                'application/octet-stream',
            }
          );

          res.end(data);
        }
      );
    }
  );

// ========================================================
// START SERVER
// ========================================================

server.listen(
  PORT,
  () => {
    console.log(
      '\n╔══════════════════════════════════════════╗'
    );

    console.log(
      '║          NEUROAGENT  v1.0.0              ║'
    );

    console.log(
      `║    http://localhost:${PORT}                 ║`
    );

    console.log(
      '║    Agentic EEG Intelligence Dashboard    ║'
    );

    console.log(
      '╚══════════════════════════════════════════╝\n'
    );

    console.log(
      'Serving from:',
      PROJECT_ROOT
    );

    console.log(
      'Backend data:',
      PROCESSED_DIR
    );



    console.log(
      'Frontend origin:',
      FRONTEND_ORIGIN
    );

    console.log(
      '\nPress Ctrl+C to stop.\n'
    );
  }
);