import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Brain } from 'lucide-react';

interface SignUpProps {
  onSignUpSuccess: (email: string) => void;
  onGoToSignIn: () => void;
}

const API = 'http://localhost:3000';

export const SignUp: React.FC<SignUpProps> = ({
  onSignUpSuccess,
  onGoToSignIn,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Full name validation
    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }

    if (cleanName.length < 2) {
      setError('Full name must contain at least 2 characters.');
      return;
    }

    if (cleanName.length > 50) {
      setError('Full name must be less than 50 characters.');
      return;
    }

    // Email validation
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Password validation
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
          confirmPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.error || 'Unable to create account.');
        setLoading(false);
        return;
      }

      // Move to OTP verification
      onSignUpSuccess(cleanEmail);
    } catch (err) {
      console.error('Signup error:', err);
      setError(
        'Cannot connect to the server. Make sure the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050811] text-white flex items-center justify-center px-4 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-200px] right-[-200px] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-400/30 flex items-center justify-center shadow-lg shadow-cyan-500/10 mb-4">
            <Brain className="w-7 h-7 text-cyan-400" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
          CREATE YOUR ACCOUNT  
      </h1>

          <p className="text-gray-400 text-sm mt-2">
            Join NeuroAgent
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0a101c]/95 border border-white/10 rounded-2xl p-6 shadow-2xl">

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* FULL NAME */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Full Name
              </label>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  disabled={loading}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all"
                />
              </div>
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Email Address
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={loading}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Password
              </label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full h-11 pl-10 pr-11 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-1.5">
                Minimum 8 characters
              </p>
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Confirm Password
              </label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full h-11 pl-10 pr-11 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* SIGN UP BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* SIGN IN */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onGoToSignIn}
                className="text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-5">
          NeuroAgent • EEG Intelligence Platform
        </p>
      </div>
    </div>
  );
};

export default SignUp;