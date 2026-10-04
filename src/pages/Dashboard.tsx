import React, { useState } from 'react';

import { useNeuro } from '../context/NeuroContext';

import { EEGScalp3D } from '../components/eeg/EEGScalp3D';
import { EEGChannelList } from '../components/eeg/EEGChannelList';
import { ICAComponentPanel } from '../components/ica/ICAComponentPanel';
import { BeforeAfterCharts } from '../components/charts/BeforeAfterCharts';

import {
  Brain,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

export const Dashboard = () => {
  // Get the active EEG file info from context
  const {
    uploadedFileName,
    uploadedFile,
    subject,
    recording,
    channels,
  } = useNeuro();

  const currentInputFile =
    uploadedFileName ||
    uploadedFile?.name ||
    `${subject}${recording}.edf`;

  const fileMatch = currentInputFile.match(/^(.+?)(R\d+)\.edf$/i);
  const activeSubject = fileMatch ? fileMatch[1].toUpperCase() : subject;
  const activeRecording = fileMatch ? fileMatch[2].toUpperCase() : recording;

  const [n8nStatus, setN8nStatus] = useState('READY');

  const [n8nMessage, setN8nMessage] = useState(
    'Automation layer ready'
  );

  // ============================================================
  // n8n TEST
  // ============================================================
  const testN8n = async () => {
    setN8nStatus('PROCESSING');
    setN8nMessage('Sending uploaded EEG file to n8n...');

    try {
      // --------------------------------------------------------
      // Make sure a file has been uploaded
      // --------------------------------------------------------
      if (!uploadedFileName) {
        setN8nStatus('FAILED');
        setN8nMessage(
          'Please upload an EEG .edf file first.'
        );
        return;
      }

      // --------------------------------------------------------
      // Use EXACTLY the file uploaded by the user
      // --------------------------------------------------------
      const filename = uploadedFileName;

      // --------------------------------------------------------
      // Extract subject and recording automatically
      //
      // Example:
      // S002R01.edf -> S002 + R01
      // S109R02.edf -> S109 + R02
      // S003R05.edf -> S003 + R05
      //
      // Nothing is hardcoded.
      // --------------------------------------------------------
      const match = filename.match(/^(.+?)(R\d+)\.edf$/i);

      if (!match) {
        setN8nStatus('FAILED');

        setN8nMessage(
          `Invalid EEG filename format: ${filename}`
        );

        return;
      }

      const targetSubject = match[1].toUpperCase();
      const targetRecording = match[2].toUpperCase();

      // --------------------------------------------------------
      // Show exactly what is being sent to n8n
      // --------------------------------------------------------
      console.log('Sending uploaded file to n8n:', {
        subject: targetSubject,
        recording: targetRecording,
        filename: filename,
      });

      // --------------------------------------------------------
      // Send request to n8n
      // --------------------------------------------------------
      const response = await fetch(
        'http://localhost:5678/webhook/neuroagent',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            subject: targetSubject,
            recording: targetRecording,
            filename: filename,
          }),
        }
      );

      // --------------------------------------------------------
      // Read n8n response
      // --------------------------------------------------------
      const result = await response.json();

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------
      if (response.ok) {
        setN8nStatus('SUCCESS');

        setN8nMessage(
          `EEG pipeline completed successfully — ${filename}`
        );
      }

      // --------------------------------------------------------
      // FAILED
      // --------------------------------------------------------
      else {
        setN8nStatus('FAILED');

        setN8nMessage(
          result?.error ||
            result?.message ||
            'Automation failed'
        );
      }

    } catch (error) {
      // --------------------------------------------------------
      // CONNECTION ERROR
      // --------------------------------------------------------
      console.error('n8n test error:', error);

      setN8nStatus('FAILED');

      setN8nMessage(
        'Cannot connect to n8n. Make sure n8n is running.'
      );
    }
  };

  // ============================================================
  // STATUS STYLE
  // ============================================================
  const getStatusStyle = () => {
    if (n8nStatus === 'SUCCESS') {
      return {
        border: 'border-green-500/30',
        bg: 'bg-green-500/5',
        text: 'text-green-400',
        dot: 'bg-green-400',
      };
    }

    if (n8nStatus === 'FAILED') {
      return {
        border: 'border-red-500/30',
        bg: 'bg-red-500/5',
        text: 'text-red-400',
        dot: 'bg-red-400',
      };
    }

    if (n8nStatus === 'PROCESSING') {
      return {
        border: 'border-cyan-500/30',
        bg: 'bg-cyan-500/5',
        text: 'text-cyan-400',
        dot: 'bg-cyan-400',
      };
    }

    return {
      border: 'border-cyan-500/20',
      bg: 'bg-cyan-500/5',
      text: 'text-cyan-300',
      dot: 'bg-cyan-400',
    };
  };

  const statusStyle = getStatusStyle();

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto p-4 select-none">

      {/* ====================================================== */}
      {/* N8N AUTOMATION STATUS                                  */}
      {/* ====================================================== */}

      <div
        className={`
          rounded-2xl glass-panel
          ${statusStyle.border}
          ${statusStyle.bg}
          px-4 py-3
          flex items-center justify-between
        `}
      >

        <div className="flex items-center gap-3">

          {/* n8n icon */}
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-cyan-300" />
          </div>

          {/* Status text */}
          <div>

            <div className="flex items-center gap-2">

              <h2 className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase">
                n8n Automation
              </h2>

              <span
                className={`
                  w-2 h-2 rounded-full
                  ${statusStyle.dot}
                  ${
                    n8nStatus === 'PROCESSING'
                      ? 'animate-pulse'
                      : ''
                  }
                `}
              />

            </div>

            <div
              className={`
                text-[10px]
                font-mono
                ${statusStyle.text}
              `}
            >

              {n8nStatus === 'PROCESSING' && (
                <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />
              )}

              {n8nStatus === 'SUCCESS' && (
                <CheckCircle2 className="inline w-3 h-3 mr-1" />
              )}

              {n8nStatus === 'FAILED' && (
                <XCircle className="inline w-3 h-3 mr-1" />
              )}

              {n8nStatus} — {n8nMessage}

            </div>

          </div>

        </div>

        {/* Test n8n button */}
        <button
          onClick={testN8n}
          disabled={n8nStatus === 'PROCESSING'}
          className="
            px-3 py-1.5
            rounded-lg
            border border-cyan-400/30
            bg-cyan-500/10
            text-cyan-300
            text-[10px]
            font-mono
            uppercase
            tracking-wider
            hover:bg-cyan-500/20
            hover:border-cyan-400/50
            disabled:opacity-40
            disabled:cursor-not-allowed
            transition
          "
        >
          Test n8n
        </button>

      </div>

      {/* ====================================================== */}
      {/* CENTRAL WORKSPACE                                      */}
      {/* ====================================================== */}

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-[460px]">

        {/* ==================================================== */}
        {/* LEFT / CENTER PANEL                                  */}
        {/* ==================================================== */}

        <div className="col-span-7 flex flex-col rounded-2xl glass-panel border border-cyan-500/20 shadow-panel overflow-hidden">

          <div className="px-4 py-2.5 border-b border-cyan-500/15 flex items-center justify-between bg-[#081121]/50">

            <div className="flex items-center gap-2">

              <div className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                <Brain className="w-3.5 h-3.5" />
              </div>

              <div>

                <h2 className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase">
                  EEG Channels{' '}
                  <span className="text-gray-400 font-normal">
                    (3D Scalp View)
                  </span>
                </h2>

                <div className="text-[10px] text-gray-400 font-mono">
                  64 Channels (10-20 System)
                </div>

              </div>

            </div>

            {/* Active Input Placement Info Banner */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-400/30 text-[10px] font-mono shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-gray-400 uppercase tracking-wider text-[9px]">Input Source:</span>
                </div>
                <span className="font-bold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-400/20">
                  {currentInputFile}
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-300">
                  Subj: <span className="text-white font-semibold">{activeSubject}</span>
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-300">
                  <span className="text-emerald-400 font-semibold">{channels.length}</span> Electrodes
                </span>
              </div>
            </div>

          </div>

          <div className="flex-1 flex overflow-hidden">

            <div className="flex-1 relative h-full">
              <EEGScalp3D />
            </div>

            <EEGChannelList />

          </div>

        </div>

        {/* ==================================================== */}
        {/* RIGHT PANEL                                          */}
        {/* ==================================================== */}

        <div className="col-span-5 h-full">
          <ICAComponentPanel />
        </div>

      </div>

      {/* ====================================================== */}
      {/* BOTTOM WORKSPACE                                      */}
      {/* ====================================================== */}

      <div className="w-full">
        <BeforeAfterCharts />
      </div>

    </div>
  );
};

export default Dashboard;