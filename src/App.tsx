import React, { useEffect, useState } from 'react';

import { useNeuro } from './context/NeuroContext';

import { TopHeader } from './components/layout/TopHeader';
import { Sidebar } from './components/layout/Sidebar';

import { Dashboard } from './pages/Dashboard';
import { EEGData } from './pages/EEGData';
import { Channels } from './pages/Channels';
import { Preprocessing } from './pages/Preprocessing';
import { ICAAnalysis } from './pages/ICAAnalysis';
import { ArtifactAI } from './pages/ArtifactAI';
import { Reconstruction } from './pages/Reconstruction';
import { QualityCheck } from './pages/QualityCheck';
import { Visualization } from './pages/Visualization';
import { Reports } from './pages/Reports';
import { Export } from './pages/Export';

import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { OTPVerification } from './pages/OTPVerification';

const API = 'http://localhost:3000';

type AuthPage = 'signin' | 'signup' | 'otp';

export const App: React.FC = () => {
  const { activeRoute } = useNeuro();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const [authPage, setAuthPage] =
    useState<AuthPage>('signin');

  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] =
    useState<'signin' | 'signup'>('signin');

  // ------------------------------------------------------
  // Check existing login session
  // ------------------------------------------------------

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(
          `${API}/api/auth/status`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );

        const result = await response.json();

        if (result.authenticated) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }

      } catch (error) {
        console.error(
          'Authentication check failed:',
          error
        );

        setAuthenticated(false);

      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // ------------------------------------------------------
  // Sign In → OTP
  // ------------------------------------------------------

  const handleSignInSuccess = (email: string) => {
    setOtpEmail(email);
    setOtpPurpose('signin');
    setAuthPage('otp');
  };

  // ------------------------------------------------------
  // Sign Up → OTP
  // ------------------------------------------------------

  const handleSignUpSuccess = (email: string) => {
    setOtpEmail(email);
    setOtpPurpose('signup');
    setAuthPage('otp');
  };

  // ------------------------------------------------------
  // OTP → Dashboard
  // ------------------------------------------------------

  const handleOTPVerified = () => {
    setAuthenticated(true);
  };

  // ------------------------------------------------------
  // Existing NeuroAgent pages
  // ------------------------------------------------------

  const renderCurrentPage = () => {
    switch (activeRoute) {

      case 'dashboard':
        return <Dashboard />;

      case 'data':
        return <EEGData />;

      case 'channels':
        return <Channels />;

      case 'preprocessing':
        return <Preprocessing />;

      case 'ica':
        return <ICAAnalysis />;

      case 'ai':
        return <ArtifactAI />;

      case 'reconstruction':
        return <Reconstruction />;

      case 'quality':
        return <QualityCheck />;

      case 'visualization':
        return <Visualization />;

      case 'reports':
        return <Reports />;

      case 'export':
        return <Export />;

      default:
        return <Dashboard />;
    }
  };

  // ------------------------------------------------------
  // Checking authentication
  // ------------------------------------------------------

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full bg-[#050811] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />

          <p className="text-gray-400 text-sm">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------
  // Authentication screens
  // ------------------------------------------------------

  if (!authenticated) {

    if (authPage === 'signin') {
      return (
        <SignIn
          onSignInSuccess={handleSignInSuccess}
          onGoToSignUp={() =>
            setAuthPage('signup')
          }
        />
      );
    }

    if (authPage === 'signup') {
      return (
        <SignUp
          onSignUpSuccess={handleSignUpSuccess}
          onGoToSignIn={() =>
            setAuthPage('signin')
          }
        />
      );
    }

    if (authPage === 'otp') {
      return (
        <OTPVerification
          email={otpEmail}
          purpose={otpPurpose}
          onVerified={handleOTPVerified}
          onBack={() =>
            setAuthPage(
              otpPurpose === 'signup'
                ? 'signup'
                : 'signin'
            )
          }
        />
      );
    }
  }

  // ------------------------------------------------------
  // Main NeuroAgent application
  // ------------------------------------------------------

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050811] text-[#f0f6fc] overflow-hidden select-none font-sans">

      {/* TOP HEADER */}
      <TopHeader />

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        <Sidebar />

        {/* MAIN WORKSPACE */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {renderCurrentPage()}
        </main>

      </div>

    </div>
  );
};

export default App;