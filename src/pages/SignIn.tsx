import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Brain, Loader2 } from 'lucide-react';

interface SignInProps {
  onSignInSuccess: (email: string) => void;
  onGoToSignUp: () => void;
}

const API = 'http://localhost:3000';

export const SignIn: React.FC<SignInProps> = ({
  onSignInSuccess,
  onGoToSignUp,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.error || 'Sign in failed.');
        return;
      }

      onSignInSuccess(email.trim().toLowerCase());

    } catch (err) {
      console.error(err);
      setError(
        'Cannot connect to NeuroAgent server. Make sure the server is running.'
      );
    } finally {
      setLoading(false);
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

        {/* Login Card */}
        <div className="bg-[#0b111d] border border-white/10 rounded-2xl p-7 shadow-2xl">

          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Welcome back
            </h2>

            <p className="text-sm text-gray-400 mt-1">
              Sign in to continue to NeuroAgent
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Email address
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-12 bg-[#070c15] border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder-gray-600 outline-none focus:border-cyan-400/50 transition"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Password
              </label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-12 bg-[#070c15] border border-white/10 rounded-xl pl-11 pr-12 text-white placeholder-gray-600 outline-none focus:border-cyan-400/50 transition"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Sign In */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#031017] font-semibold flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Sign Up */}
          <div className="mt-7 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?
            </p>

            <button
              type="button"
              onClick={onGoToSignUp}
              className="mt-2 text-cyan-400 hover:text-cyan-300 font-medium text-sm"
            >
              Create an account
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Secure authentication with email OTP verification
        </p>

      </div>
    </div>
  );
};

export default SignIn;