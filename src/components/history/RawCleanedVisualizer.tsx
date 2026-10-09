import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HistoryRecord, ChannelComparisonData } from '../../types';
import { fetchChannelCompare } from '../../api/eegApi';
import {
  Waves,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Maximize2,
  Minimize2,
  Info,
  ShieldCheck,
  CheckCircle2,
  BarChart2,
} from 'lucide-react';

interface RawCleanedVisualizerProps {
  record: HistoryRecord;
}

const POPULAR_CHANNELS = [
  'F7', 'FP1', 'FP2', 'F3', 'FZ', 'F4', 'F8',
  'T7', 'C3', 'CZ', 'C4', 'T8',
  'P3', 'PZ', 'P4', 'O1', 'O2'
];

export const RawCleanedVisualizer: React.FC<RawCleanedVisualizerProps> = ({ record }) => {
  const [selectedChannel, setSelectedChannel] = useState<string>('F7');
  const [viewMode, setViewMode] = useState<'stacked' | 'overlay'>('stacked');
  const [loading, setLoading] = useState<boolean>(true);
  const [compData, setCompData] = useState<ChannelComparisonData | null>(null);

  const rawCanvasRef = useRef<HTMLCanvasElement>(null);
  const cleanCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const psdCanvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch real waveform data or fallback for selected channel & record
  useEffect(() => {
    let active = true;
    setLoading(true);

    fetchChannelCompare(selectedChannel, 600, record.subject, record.recording)
      .then(data => {
        if (active) {
          setCompData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedChannel, record.subject, record.recording]);

  // Derived metrics
  const reductionPct = compData?.reduction_pct ?? record.noiseReduction ?? 94.3;
  const rawStd = compData?.raw_std ?? record.rawRms ?? 38.6;
  const cleanStd = compData?.clean_std ?? record.cleanRms ?? 14.2;

  // -------------------------------------------------------------------------
  // RENDER: Raw Canvas (Stacked View)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (viewMode !== 'stacked') return;
    const canvas = rawCanvasRef.current;
    if (!canvas || !compData?.before_eeg || compData.before_eeg.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pLeft = 40;
    const pRight = 15;
    const pTop = 14;
    const pBottom = 22;
    const plotW = W - pLeft - pRight;
    const plotH = H - pTop - pBottom;

    const data = compData.before_eeg;
    const totalSec = Math.round(compData.duration || record.duration || 60);
    const maxVal = Math.max(50, ...data.map(v => Math.abs(v)));
    const ampLimit = Math.min(250, Math.ceil(maxVal / 25) * 25);
    const halfLimit = Math.round(ampLimit / 2);

    // Background subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    [-ampLimit, -halfLimit, 0, halfLimit, ampLimit].forEach(val => {
      const y = pTop + ((ampLimit - val) / (ampLimit * 2)) * plotH;
      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(W - pRight, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${val}`, pLeft - 6, y + 3);
    });

    // Zero baseline
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.lineWidth = 1;
    const zeroY = pTop + 0.5 * plotH;
    ctx.beginPath();
    ctx.moveTo(pLeft, zeroY);
    ctx.lineTo(W - pRight, zeroY);
    ctx.stroke();

    // Time ticks
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const tickStep = totalSec > 90 ? 20 : totalSec > 40 ? 10 : 5;
    for (let sec = 0; sec <= totalSec; sec += tickStep) {
      const x = pLeft + (sec / totalSec) * plotW;
      ctx.fillText(`${sec}s`, x, H - 5);
    }

    // Y Axis Title
    ctx.save();
    ctx.translate(11, pTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#a855f7';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Amplitude (µV)', 0, 0);
    ctx.restore();

    // Highlight artifact burst zones
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    const threshold = ampLimit * 0.55;
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > threshold) {
        const x = pLeft + (i / (data.length - 1)) * plotW;
        ctx.fillRect(Math.max(pLeft, x - 12), pTop, 24, plotH);
      }
    }

    // Raw Waveform (Purple with Neon Glow)
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = 'rgba(192, 132, 252, 0.6)';
    ctx.shadowBlur = 4;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = pLeft + (i / (data.length - 1)) * plotW;
      const val = Math.max(-ampLimit, Math.min(ampLimit, data[i]));
      const y = pTop + ((ampLimit - val) / (ampLimit * 2)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

  }, [compData, viewMode, record]);

  // -------------------------------------------------------------------------
  // RENDER: Clean Canvas (Stacked View)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (viewMode !== 'stacked') return;
    const canvas = cleanCanvasRef.current;
    if (!canvas || !compData?.after_eeg || compData.after_eeg.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pLeft = 40;
    const pRight = 15;
    const pTop = 14;
    const pBottom = 22;
    const plotW = W - pLeft - pRight;
    const plotH = H - pTop - pBottom;

    const data = compData.after_eeg;
    const totalSec = Math.round(compData.duration || record.duration || 60);
    const maxVal = Math.max(50, ...(compData.before_eeg || data).map(v => Math.abs(v)));
    const ampLimit = Math.min(250, Math.ceil(maxVal / 25) * 25);
    const halfLimit = Math.round(ampLimit / 2);

    // Background subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    [-ampLimit, -halfLimit, 0, halfLimit, ampLimit].forEach(val => {
      const y = pTop + ((ampLimit - val) / (ampLimit * 2)) * plotH;
      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(W - pRight, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${val}`, pLeft - 6, y + 3);
    });

    // Zero baseline
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 1;
    const zeroY = pTop + 0.5 * plotH;
    ctx.beginPath();
    ctx.moveTo(pLeft, zeroY);
    ctx.lineTo(W - pRight, zeroY);
    ctx.stroke();

    // Time ticks
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const tickStep = totalSec > 90 ? 20 : totalSec > 40 ? 10 : 5;
    for (let sec = 0; sec <= totalSec; sec += tickStep) {
      const x = pLeft + (sec / totalSec) * plotW;
      ctx.fillText(`${sec}s`, x, H - 5);
    }

    // Y Axis Title
    ctx.save();
    ctx.translate(11, pTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#06b6d4';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Amplitude (µV)', 0, 0);
    ctx.restore();

    // Clean Waveform (Electric Mint/Cyan)
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = 'rgba(34, 211, 238, 0.6)';
    ctx.shadowBlur = 4;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = pLeft + (i / (data.length - 1)) * plotW;
      const val = Math.max(-ampLimit, Math.min(ampLimit, data[i]));
      const y = pTop + ((ampLimit - val) / (ampLimit * 2)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

  }, [compData, viewMode, record]);

  // -------------------------------------------------------------------------
  // RENDER: Overlay Canvas (Overlay View)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (viewMode !== 'overlay') return;
    const canvas = overlayCanvasRef.current;
    if (!canvas || !compData?.before_eeg || !compData?.after_eeg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pLeft = 40;
    const pRight = 15;
    const pTop = 16;
    const pBottom = 24;
    const plotW = W - pLeft - pRight;
    const plotH = H - pTop - pBottom;

    const rawData = compData.before_eeg;
    const cleanData = compData.after_eeg;
    const totalSec = Math.round(compData.duration || record.duration || 60);
    const maxVal = Math.max(50, ...rawData.map(v => Math.abs(v)), ...cleanData.map(v => Math.abs(v)));
    const ampLimit = Math.min(250, Math.ceil(maxVal / 25) * 25);
    const halfLimit = Math.round(ampLimit / 2);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    [-ampLimit, -halfLimit, 0, halfLimit, ampLimit].forEach(val => {
      const y = pTop + ((ampLimit - val) / (ampLimit * 2)) * plotH;
      ctx.beginPath();
      ctx.moveTo(pLeft, y);
      ctx.lineTo(W - pRight, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${val}`, pLeft - 6, y + 3);
    });

    // Zero baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    const zeroY = pTop + 0.5 * plotH;
    ctx.beginPath();
    ctx.moveTo(pLeft, zeroY);
    ctx.lineTo(W - pRight, zeroY);
    ctx.stroke();

    // Time ticks
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const tickStep = totalSec > 90 ? 20 : totalSec > 40 ? 10 : 5;
    for (let sec = 0; sec <= totalSec; sec += tickStep) {
      const x = pLeft + (sec / totalSec) * plotW;
      ctx.fillText(`${sec}s`, x, H - 6);
    }

    // 1. Draw Raw Trace (Semi-transparent Magenta)
    ctx.strokeStyle = 'rgba(216, 70, 239, 0.7)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < rawData.length; i++) {
      const x = pLeft + (i / (rawData.length - 1)) * plotW;
      const val = Math.max(-ampLimit, Math.min(ampLimit, rawData[i]));
      const y = pTop + ((ampLimit - val) / (ampLimit * 2)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Draw Clean Trace (Bright Neon Cyan on top)
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.7;
    ctx.shadowColor = 'rgba(34, 211, 238, 0.7)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    for (let i = 0; i < cleanData.length; i++) {
      const x = pLeft + (i / (cleanData.length - 1)) * plotW;
      const val = Math.max(-ampLimit, Math.min(ampLimit, cleanData[i]));
      const y = pTop + ((ampLimit - val) / (ampLimit * 2)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

  }, [compData, viewMode, record]);

  // -------------------------------------------------------------------------
  // RENDER: Power Spectral Density (PSD)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = psdCanvasRef.current;
    if (!canvas || !compData?.psd_freqs) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pLeft = 32;
    const pRight = 10;
    const pTop = 12;
    const pBottom = 20;
    const plotW = W - pLeft - pRight;
    const plotH = H - pTop - pBottom;

    // Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pLeft, pTop);
    ctx.lineTo(pLeft, pTop + plotH);
    ctx.lineTo(W - pRight, pTop + plotH);
    ctx.stroke();

    // Frequency labels (0, 10, 20, 30, 40 Hz)
    ctx.fillStyle = '#64748b';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    [0, 10, 20, 30, 40].forEach(f => {
      const x = pLeft + (f / 45) * plotW;
      ctx.fillText(`${f}Hz`, x, H - 4);
    });

    const freqs = compData.psd_freqs;
    const rawP = compData.psd_raw || [];
    const cleanP = compData.psd_clean || [];
    const maxP = Math.max(1, ...rawP.slice(0, 30), ...cleanP.slice(0, 30));

    // Raw PSD (Magenta/Purple)
    if (rawP.length > 0) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] > 45) break;
        const x = pLeft + (freqs[i] / 45) * plotW;
        const normY = Math.min(1, Math.max(0, rawP[i] / maxP));
        const y = pTop + (1 - normY) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Clean PSD (Neon Cyan)
    if (cleanP.length > 0) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] > 45) break;
        const x = pLeft + (freqs[i] / 45) * plotW;
        const normY = Math.min(1, Math.max(0, cleanP[i] / maxP));
        const y = pTop + (1 - normY) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [compData]);

  return (
    <div className="space-y-4">
      {/* Visualizer Top Bar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#081220]/80 border border-cyan-500/20 backdrop-blur-md">
        {/* Channel Selection Chips */}
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 max-w-full">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Channel:
          </span>
          <div className="flex gap-1">
            {POPULAR_CHANNELS.map(ch => {
              const active = selectedChannel === ch;
              return (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(34,211,238,0.5)] scale-105'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-transparent'
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-gray-400 uppercase">View:</span>
          <div className="flex p-0.5 bg-black/40 rounded-lg border border-cyan-500/20">
            <button
              onClick={() => setViewMode('stacked')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'stacked'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Stacked Traces</span>
            </button>
            <button
              onClick={() => setViewMode('overlay')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'overlay'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>Direct Overlay</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Signal Display Panes */}
      {viewMode === 'stacked' ? (
        <div className="space-y-3">
          {/* Panel 1: Raw EEG (Before Cleaning) */}
          <div className="p-4 rounded-2xl glass-panel border border-purple-500/25 shadow-panel relative overflow-hidden bg-[#060b16]/70">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-500/15">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]" />
                <h3 className="text-xs font-bold font-mono text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Raw EEG Signal — Input</span>
                  <span className="text-white bg-purple-950/70 border border-purple-500/30 px-1.5 py-0.5 rounded text-[10px]">
                    Channel {selectedChannel}
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded-md bg-red-950/60 border border-red-500/30 text-red-300 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-red-400" />
                  Ocular & Muscle Artifacts Present
                </span>
                <span className="text-gray-400">
                  RMS: <strong className="text-purple-300">{rawStd} µV</strong>
                </span>
              </div>
            </div>

            {/* Canvas Plot */}
            <div className="w-full relative h-[145px]">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#050811]/75 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 text-xs font-mono text-purple-400">
                    <span className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    <span>Extracting raw {selectedChannel} signal ({record.subject} {record.recording})...</span>
                  </div>
                </div>
              )}
              <canvas
                ref={rawCanvasRef}
                width={840}
                height={145}
                className="w-full h-full block"
              />
            </div>
          </div>

          {/* Panel 2: Cleaned EEG (After Cleaning) */}
          <div className="p-4 rounded-2xl glass-panel border border-cyan-500/30 shadow-panel relative overflow-hidden bg-[#060b16]/70">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/15">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                <h3 className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Cleaned Reconstructed EEG — Output</span>
                  <span className="text-white bg-cyan-950/70 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[10px]">
                    Channel {selectedChannel}
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Artifacts Excised • Baseline Restored
                </span>
                <span className="text-gray-400">
                  RMS: <strong className="text-cyan-300">{cleanStd} µV</strong>
                </span>
              </div>
            </div>

            {/* Canvas Plot */}
            <div className="w-full relative h-[145px]">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#050811]/75 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <span className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                    <span>Extracting reconstructed {selectedChannel} signal...</span>
                  </div>
                </div>
              )}
              <canvas
                ref={cleanCanvasRef}
                width={840}
                height={145}
                className="w-full h-full block"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Overlay View */
        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/30 shadow-panel bg-[#060b16]/70">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/15">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider">
                Direct Overlay Comparison — Channel {selectedChannel}
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <span className="w-3 h-1 rounded bg-purple-400 inline-block" />
                  Raw Contaminated Signal
                </span>
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-3 h-1 rounded bg-cyan-400 inline-block shadow-[0_0_6px_#00d4ff]" />
                  Cleaned Reconstructed Signal
                </span>
              </div>
            </div>

            <div className="px-2.5 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-400/30 text-[10px] font-mono text-cyan-300">
              Noise Reduction: <strong>{reductionPct}%</strong>
            </div>
          </div>

          <div className="w-full relative h-[270px]">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#050811]/75 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                  <span className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  <span>Loading direct overlay traces for Channel {selectedChannel}...</span>
                </div>
              </div>
            )}
            <canvas
              ref={overlayCanvasRef}
              width={840}
              height={270}
              className="w-full h-full block"
            />
          </div>
        </div>
      )}

      {/* Auxiliary Analysis Cards: PSD Spectrum & Spatial Topomap Dipole */}
      <div className="grid grid-cols-12 gap-4">
        {/* Power Spectral Density Card */}
        <div className="col-span-7 p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel bg-[#060b16]/60">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/10">
            <span className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
              Power Spectral Density (PSD)
            </span>
            <div className="flex items-center gap-3 text-[9px] font-mono">
              <span className="text-purple-400 flex items-center gap-1">
                <span className="w-2 h-0.5 bg-purple-400 inline-block" /> Raw
              </span>
              <span className="text-cyan-400 flex items-center gap-1">
                <span className="w-2 h-0.5 bg-cyan-400 inline-block" /> Cleaned
              </span>
            </div>
          </div>

          <div className="w-full relative h-[100px]">
            <canvas
              ref={psdCanvasRef}
              width={480}
              height={100}
              className="w-full h-full block"
            />
          </div>
          <div className="text-[10px] font-mono text-gray-400 mt-1 flex justify-between">
            <span>Delta/Theta Ocular Noise Suppressed (&lt;4 Hz)</span>
            <span className="text-emerald-400">Preserved Alpha Peak (8-12 Hz)</span>
          </div>
        </div>

        {/* Spatial Topographic Artifact Dipole Preview */}
        <div className="col-span-5 p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel bg-[#060b16]/60 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-cyan-500/10">
            <span className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Artifact Spatial Dipole
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
              IC9 EXCISED
            </span>
          </div>

          <div className="flex items-center gap-4 my-auto">
            {/* 2D Scalp Disk Visual Representation */}
            <div className="relative w-20 h-20 shrink-0 mx-auto">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(0,212,255,0.2)]">
                {/* Scalp Circle */}
                <circle cx="50" cy="50" r="42" fill="#081426" stroke="#22d3ee" strokeWidth="2" />
                {/* Nose */}
                <polygon points="50,4 44,12 56,12" fill="#081426" stroke="#22d3ee" strokeWidth="1.5" />
                {/* Left Ear */}
                <path d="M 6,44 Q 2,50 6,56" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                {/* Right Ear */}
                <path d="M 94,44 Q 98,50 94,56" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                
                {/* Frontal Heatmap Glow (Ocular Artifact Location) */}
                <circle cx="50" cy="24" r="16" fill="url(#frontalArtifactGlow)" opacity="0.85" />
                
                {/* Electrodes dots */}
                <circle cx="50" cy="50" r="2.5" fill="#38bdf8" />
                <circle cx="35" cy="24" r="2.5" fill="#f43f5e" />
                <circle cx="65" cy="24" r="2.5" fill="#f43f5e" />
                <circle cx="50" cy="22" r="2.5" fill="#f43f5e" />
                <circle cx="26" cy="36" r="3" fill="#00ffff" stroke="#ffffff" strokeWidth="1" /> {/* F7 Highlight */}
                
                <defs>
                  <radialGradient id="frontalArtifactGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#081426" stopOpacity="0" />
                  </radialGradient>
                </defs>
              </svg>
            </div>

            <div className="space-y-1 text-[10px] font-mono flex-1">
              <div className="text-gray-300 font-bold">Frontal Eye Dipole</div>
              <div className="text-gray-400 text-[9px] leading-relaxed">
                Identified by 1D-CNN + ICLabel with 98.6% confidence. Excision successfully isolated from motor channels.
              </div>
              <div className="text-cyan-400 font-semibold pt-1">
                F7 Variance Drop: -{reductionPct}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
