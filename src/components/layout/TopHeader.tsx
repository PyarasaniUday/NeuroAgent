import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Brain,
  Upload,
  Play,
  User,
  UserCircle,
  ShieldCheck,
  LogOut,
  ChevronDown,
  FileText,
} from 'lucide-react';

import { useNeuro } from '../../context/NeuroContext';

const API = 'http://localhost:3000';

export const TopHeader: React.FC = () => {
  const {
    subject,
    recording,
    subjects,
    recordings,
    setSubject,
    setRecording,
    uploadedFile,
    uploadedFileName,
    setUploadedFile,
    runAnalysis,
    isProcessing,
  } = useNeuro();

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    userName,
    setUserName,
  ] = useState('NeuroAgent User');

  const [
    userEmail,
    setUserEmail,
  ] = useState('');

  const profileRef =
    useRef<HTMLDivElement>(null);

  // ======================================================
  // GET LOGGED-IN USER
  // ======================================================

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response =
          await fetch(
            `${API}/api/auth/status`,
            {
              method: 'GET',
              credentials: 'include',
            }
          );

        if (!response.ok) {
          return;
        }

        const result =
          await response.json();

        if (
          result.authenticated
        ) {
          setUserName(
            result.name ||
              'NeuroAgent User'
          );

          setUserEmail(
            result.email || ''
          );
        }
      } catch (error) {
        console.error(
          'Failed to load user profile:',
          error
        );
      }
    };

    loadProfile();
  }, []);

  // ======================================================
  // CLOSE PROFILE WHEN CLICKING OUTSIDE
  // ======================================================

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target as Node
        )
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  // ======================================================
  // FILE UPLOAD
  // ======================================================

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith('.edf')
    ) {
      alert(
        'Please select an EEG .edf file.'
      );

      event.target.value = '';
      return;
    }

    setUploadedFile(file);
  };

  // ======================================================
  // RUN ANALYSIS
  // ======================================================

  const handleRunAnalysis =
    async () => {
      if (!uploadedFile) {
        alert(
          'Please upload an EEG .edf file first.'
        );
        return;
      }

      await runAnalysis(
        uploadedFile
      );
    };

  // ======================================================
  // LOGOUT
  // ======================================================

  const handleLogout =
    async () => {
      try {
        await fetch(
          `${API}/api/auth/logout`,
          {
            method: 'POST',
            credentials: 'include',
          }
        );
      } catch (error) {
        console.error(
          'Logout error:',
          error
        );
      } finally {
        window.location.href = '/';
      }
    };

  return (
    <header className="relative z-50 h-16 flex-shrink-0 bg-[#080d18] border-b border-white/10 px-4 flex items-center">

      {/* ==================================================
          LEFT - BRAND
          ================================================== */}

      <div className="flex items-center gap-3 min-w-[210px]">
        <div className="w-9 h-9 rounded-xl bg-cyan-950/70 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.08)]">
          <Brain className="w-5 h-5 text-cyan-300" />
        </div>

        <div>
          <div className="text-sm font-bold tracking-wide text-white">
            NeuroAgent
          </div>

          <div className="text-[9px] text-cyan-400/70 uppercase tracking-[0.18em]">
            EEG Intelligence
          </div>
        </div>
      </div>

      {/* ==================================================
          CENTER - EEG CONTROLS
          ================================================== */}

      <div className="flex-1 flex items-center justify-center gap-2">

        {/* Subject */}
        <select
          value={subject}
          onChange={e =>
            setSubject(e.target.value)
          }
          className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-gray-200 outline-none focus:border-cyan-400/40"
          title="Subject"
        >
          {subjects?.map(
            item => (
              <option
                key={item}
                value={item}
                className="bg-[#0a101d]"
              >
                {item}
              </option>
            )
          )}
        </select>

        {/* Recording */}
        <select
          value={recording}
          onChange={e =>
            setRecording(
              e.target.value
            )
          }
          className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-gray-200 outline-none focus:border-cyan-400/40"
          title="Recording"
        >
          {recordings?.map(
            item => (
              <option
                key={item}
                value={item}
                className="bg-[#0a101d]"
              >
                {item}
              </option>
            )
          )}
        </select>

        {/* File upload */}
        <label className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] hover:border-cyan-400/30 text-xs text-gray-300 flex items-center gap-2 cursor-pointer transition-all">
          <Upload className="w-3.5 h-3.5 text-cyan-400" />

          <span className="max-w-[150px] truncate">
            {uploadedFileName ||
              'Upload EEG'}
          </span>

          <input
            type="file"
            accept=".edf"
            onChange={
              handleFileChange
            }
            className="hidden"
          />
        </label>

        {/* Run analysis */}
        <button
          type="button"
          onClick={
            handleRunAnalysis
          }
          disabled={isProcessing}
          className="h-9 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#031018] text-xs font-semibold flex items-center gap-2 transition-all"
        >
          {isProcessing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-[#031018]/30 border-t-[#031018] rounded-full animate-spin" />
              Processing
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* ==================================================
          RIGHT
          ================================================== */}

      <div className="flex items-center gap-3 min-w-[250px] justify-end">

        {/* File/session indicator */}
        <div className="hidden xl:flex items-center gap-2 text-[10px] text-gray-500">
          <FileText className="w-3.5 h-3.5" />

          <span>
            {uploadedFileName
              ? uploadedFileName
              : `${subject}${recording}`}
          </span>
        </div>

        {/* System online */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

          <span className="tracking-wide">
            System Online
          </span>
        </div>

        {/* =================================================
            PROFILE
            ================================================= */}

        <div
          ref={profileRef}
          className="relative"
        >
          <button
            type="button"
            onClick={() =>
              setProfileOpen(
                previous =>
                  !previous
              )
            }
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/[0.06] border border-transparent hover:border-cyan-400/20 transition-all cursor-pointer"
            title="Profile"
          >
            <div className="w-8 h-8 rounded-full bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.08)]">
              <User className="w-4 h-4" />
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                profileOpen
                  ? 'rotate-180'
                  : ''
              }`}
            />
          </button>

          {/* =================================================
              PROFILE DROPDOWN
              ================================================= */}

          {profileOpen && (
            <div className="absolute right-0 top-12 w-72 rounded-xl bg-[#0b1220] border border-white/10 shadow-2xl overflow-hidden">

              {/* User info */}
              <div className="p-4 border-b border-white/10">

                <div className="flex items-center gap-3">

                  <div className="w-11 h-11 rounded-full bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                    <UserCircle className="w-6 h-6" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {userName}
                    </p>

                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {userEmail ||
                        'No email available'}
                    </p>
                  </div>

                </div>
              </div>

              {/* Account status */}
              <div className="px-4 py-3">

                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />

                  <div>
                    <p className="text-xs text-gray-300">
                      Email verified
                    </p>

                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Account authenticated
                    </p>
                  </div>
                </div>

              </div>

              {/* Logout */}
              <div className="border-t border-white/10 p-2">

                <button
                  type="button"
                  onClick={
                    handleLogout
                  }
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />

                  <span>
                    Logout
                  </span>
                </button>

              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopHeader;