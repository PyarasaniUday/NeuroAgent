import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Loader2,
  Mail,
} from 'lucide-react';

interface OTPVerificationProps {
  email: string;
  purpose: 'signin' | 'signup';
  onVerified: () => void;
  onBack: () => void;
}

const API = 'http://localhost:3000';

export const OTPVerification: React.FC<
  OTPVerificationProps
> = ({
  email,
  purpose,
  onVerified,
  onBack,
}) => {
  const [otp, setOtp] = useState([
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const [resendSeconds, setResendSeconds] =
    useState(60);

  const inputRefs = useRef<
    Array<HTMLInputElement | null>
  >([]);

  // ------------------------------------------------------
  // Countdown for resend OTP
  // ------------------------------------------------------

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendSeconds((seconds) =>
        seconds > 0 ? seconds - 1 : 0
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resendSeconds]);

  // ------------------------------------------------------
  // Handle OTP input
  // ------------------------------------------------------

  const handleChange = (
    index: number,
    value: string
  ) => {
    // Only allow numbers
    const numberOnly = value
      .replace(/\D/g, '')
      .slice(-1);

    const newOtp = [...otp];

    newOtp[index] = numberOnly;

    setOtp(newOtp);
    setError('');

    // Move to next box
    if (
      numberOnly &&
      index < 5
    ) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ------------------------------------------------------
  // Handle backspace
  // ------------------------------------------------------

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      e.key === 'Backspace' &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ------------------------------------------------------
  // Handle paste
  // ------------------------------------------------------

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);

    if (!pasted) {
      return;
    }

    const newOtp = [
      '',
      '',
      '',
      '',
      '',
      '',
    ];

    pasted
      .split('')
      .forEach((digit, index) => {
        newOtp[index] = digit;
      });

    setOtp(newOtp);
    setError('');

    const nextIndex = Math.min(
      pasted.length,
      5
    );

    inputRefs.current[nextIndex]?.focus();
  };

  // ------------------------------------------------------
  // Verify OTP
  // ------------------------------------------------------

  const handleVerify = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError('');

    const enteredOTP = otp.join('');

    if (enteredOTP.length !== 6) {
      setError(
        'Please enter the complete 6-digit OTP.'
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API}/api/auth/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            email,
            otp: enteredOTP,
            purpose,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result?.error ||
            'Invalid or expired OTP.'
        );
        return;
      }

      // OTP verified successfully
      onVerified();

    } catch (err) {
      console.error(err);

      setError(
        'Cannot connect to NeuroAgent server. Make sure the server is running.'
      );

    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------
  // Resend OTP
  // ------------------------------------------------------

  const handleResend = async () => {
    if (resendSeconds > 0 || resending) {
      return;
    }

    setError('');

    try {
      setResending(true);

      const response = await fetch(
        `${API}/api/auth/resend-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            email,
            purpose,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result?.error ||
            'Unable to resend OTP.'
        );
        return;
      }

      // Clear old OTP
      setOtp([
        '',
        '',
        '',
        '',
        '',
        '',
      ]);

      // Restart countdown
      setResendSeconds(60);

      // Focus first input
      inputRefs.current[0]?.focus();

    } catch (err) {
      console.error(err);

      setError(
        'Cannot connect to NeuroAgent server.'
      );

    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050811] text-white flex items-center justify-center p-6">

      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">

          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center mb-4">

            <Brain className="w-9 h-9 text-cyan-400" />

          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            NeuroAgent
          </h1>

          <p className="text-gray-400 mt-2 text-sm text-center">
            Agentic AI-Based Intelligent EEG Assistive System
          </p>

        </div>

        {/* OTP Card */}
        <div className="bg-[#0b111d] border border-white/10 rounded-2xl p-7 shadow-2xl">

          {/* Icon */}
          <div className="flex justify-center mb-5">

            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">

              <Mail className="w-6 h-6 text-cyan-400" />

            </div>

          </div>

          <div className="text-center mb-7">

            <h2 className="text-xl font-semibold">
              Verify your email
            </h2>

            <p className="text-sm text-gray-400 mt-2 leading-6">
              We sent a 6-digit verification code to
            </p>

            <p className="text-sm text-cyan-400 font-medium mt-1 break-all">
              {email}
            </p>

          </div>

          <form onSubmit={handleVerify}>

            {/* OTP Boxes */}
            <div className="flex justify-center gap-2 mb-6">

              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] =
                      element;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) =>
                    handleChange(
                      index,
                      e.target.value
                    )
                  }
                  onKeyDown={(e) =>
                    handleKeyDown(
                      index,
                      e
                    )
                  }
                  onPaste={handlePaste}
                  className="w-11 h-13 text-center text-xl font-semibold bg-[#070c15] border border-white/10 rounded-xl text-white outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition"
                  aria-label={`OTP digit ${
                    index + 1
                  }`}
                />
              ))}

            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 mb-5 text-center">
                {error}
              </div>
            )}

            {/* Verify */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#031017] font-semibold flex items-center justify-center gap-2 transition"
            >

              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify OTP
                  <ArrowRight className="w-5 h-5" />
                </>
              )}

            </button>

          </form>

          {/* Resend */}
          <div className="text-center mt-6">

            <p className="text-sm text-gray-500">
              Didn't receive the code?
            </p>

            <button
              type="button"
              onClick={handleResend}
              disabled={
                resendSeconds > 0 ||
                resending
              }
              className="mt-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 disabled:text-gray-600 disabled:cursor-not-allowed"
            >

              {resending
                ? 'Sending...'
                : resendSeconds > 0
                ? `Resend OTP in ${resendSeconds}s`
                : 'Resend OTP'}

            </button>

          </div>

          {/* Back */}
          <div className="mt-6 pt-5 border-t border-white/10">

            <button
              type="button"
              onClick={onBack}
              className="w-full text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 transition"
            >

              <ArrowLeft className="w-4 h-4" />

              Back

            </button>

          </div>

        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          OTP expires after a limited time for security
        </p>

      </div>

    </div>
  );
};

export default OTPVerification;