import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  EEGSession,
  ICAComponent,
  ChannelInfo,
  ChannelComparisonData,
  TopomapData,
  QualityReport,
  DecisionType,
  WorkflowStep,
} from '../types';
import * as eegApi from '../api/eegApi';
import * as analysisApi from '../api/analysisApi';
import * as reconstructionApi from '../api/reconstructionApi';

interface NeuroContextType {
  subject: string;
  recording: string;
  session: EEGSession | null;
  subjects: string[];
  recordings: string[];
  channels: ChannelInfo[];
  selectedChannel: string;
  components: ICAComponent[];
  selectedComponent: ICAComponent | null;
  selectedComponentId: string;
  comparisonData: ChannelComparisonData | null;
  topomapData: TopomapData | null;
  quality: QualityReport | null;
  workflowSteps: WorkflowStep[];
  activeRoute: string;
  is3D: boolean;
  cameraView: 'top' | 'front' | 'left' | 'right' | 'reset';
  isLoading: boolean;
  isProcessing: boolean;
  processingProgress: number;
  processingStage: string;
  humanDecisions: Record<string, DecisionType>;
  
  uploadedFile: File | null;
  uploadedFileName: string | null;
  setUploadedFile: (file: File | null) => void;
  runAnalysis: (fileToRun?: File | null) => Promise<boolean>;

  // Actions
  setSubject: (s: string) => void;
  setRecording: (r: string) => void;
  setSelectedChannel: (ch: string) => void;
  setSelectedComponentId: (id: string) => void;
  nextComponent: () => void;
  prevComponent: () => void;
  setHumanDecision: (comp: string, dec: DecisionType) => void;
  setActiveRoute: (route: string) => void;
  setIs3D: (val: boolean) => void;
  setCameraView: (v: 'top' | 'front' | 'left' | 'right' | 'reset') => void;
  runPipelineStage: (stageName: string) => Promise<void>;
  refreshAll: (overrideSubj?: string, overrideRec?: string) => Promise<void>;
}

const NeuroContext = createContext<NeuroContextType | null>(null);

export const NeuroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subject, setSubjectState] = useState<string>('S002');
  const [recording, setRecordingState] = useState<string>('R01');
  const [subjects, setSubjects] = useState<string[]>(['S002', 'S003', 'S004', 'S005']);
  const [recordings, setRecordings] = useState<string[]>(['R01', 'R02', 'R03']);
  const [session, setSession] = useState<EEGSession | null>(null);

  const [channels, setChannels] = useState<ChannelInfo[]>(eegApi.STANDARD_64_CHANNELS);
  const [selectedChannel, setSelectedChannelState] = useState<string>('F7');

  const [components, setComponents] = useState<ICAComponent[]>(analysisApi.GENERATED_DEFAULT_COMPONENTS);
  const [selectedComponentId, setSelectedComponentIdState] = useState<string>('IC9');

  const [comparisonData, setComparisonData] = useState<ChannelComparisonData | null>(null);
  const [topomapData, setTopomapData] = useState<TopomapData | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);

  const [activeRoute, setActiveRoute] = useState<string>('dashboard');
  const [is3D, setIs3D] = useState<boolean>(true);
  const [cameraView, setCameraView] = useState<'top' | 'front' | 'left' | 'right' | 'reset'>('top');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStage, setProcessingStage] = useState<string>('');

  const [humanDecisions, setHumanDecisions] = useState<Record<string, DecisionType>>({
    IC9: 'REMOVE',
  });

  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    { id: 1, title: 'Load EEG', status: 'completed', path: 'data' },
    { id: 2, title: 'Preprocessing', status: 'completed', path: 'preprocessing' },
    { id: 3, title: 'ICA Decomposition', status: 'completed', path: 'ica' },
    { id: 4, title: 'AI Analysis', status: 'in_progress', path: 'ai' },
    { id: 5, title: 'Reconstruction', status: 'pending', path: 'reconstruction' },
    { id: 6, title: 'Quality Check', status: 'pending', path: 'quality' },
  ]);

  const [uploadedFile, setUploadedFileState] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const setUploadedFile = useCallback((file: File | null) => {
    setUploadedFileState(file);
    setUploadedFileName(file ? file.name : null);
  }, []);

  // Load subject/recording lists
  useEffect(() => {
    eegApi.fetchSubjects().then(setSubjects);
  }, []);

  useEffect(() => {
    eegApi.fetchRecordings(subject).then(setRecordings);
  }, [subject]);

  // Fetch session, channels, components, and quality on subject/recording change
  const refreshAll = useCallback(async (overrideSubj?: string, overrideRec?: string) => {
    const s = overrideSubj || subject;
    const r = overrideRec || recording;
    setIsLoading(true);
    try {
      const [sess, chs, comps, qual] = await Promise.all([
        eegApi.fetchSession(s, r),
        eegApi.fetchChannels(s, r),
        analysisApi.fetchComponents(s, r),
        reconstructionApi.fetchQualityReport(s, r),
      ]);

      if (sess) setSession(sess);
      if (chs && chs.length > 0) setChannels(chs);
      if (comps && comps.length > 0) setComponents(comps);
      if (qual) setQuality(qual);
    } catch (e) {
      console.error('Error refreshing data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [subject, recording]);

  const runAnalysis = useCallback(async (fileToRun?: File | null): Promise<boolean> => {
    const file = fileToRun !== undefined ? fileToRun : uploadedFile;
    setIsProcessing(true);
    setProcessingStage('Initializing Analysis Pipeline...');
    setProcessingProgress(15);

    try {
      let targetSubj = subject;
      let targetRec = recording;
      let filename = file ? file.name : `${subject}${recording}.edf`;

      if (file) {
        setProcessingStage('Uploading EDF file...');
        setProcessingProgress(35);
        const upRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'x-filename': encodeURIComponent(file.name) },
          credentials: 'include',
          body: file,
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          if (upData.subject) targetSubj = upData.subject;
          if (upData.recording) targetRec = upData.recording;
        }
      }

      setProcessingStage('Executing Backend ML & ICA Pipeline...');
      setProcessingProgress(65);

      const runRes = await fetch('/api/run-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename,
          subject: targetSubj,
          recording: targetRec,
        }),
      });

      if (runRes.ok) {
        const runData = await runRes.json();
        setProcessingProgress(90);
        setProcessingStage('Updating Dashboard with Results...');

        if (runData.subject) setSubjectState(runData.subject);
        if (runData.recording) setRecordingState(runData.recording);
        if (runData.session) setSession(runData.session);

        await refreshAll(runData.subject || targetSubj, runData.recording || targetRec);
        setProcessingProgress(100);
        return true;
      }
    } catch (err) {
      console.error('runAnalysis error:', err);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStage('');
    }
    return false;
  }, [uploadedFile, subject, recording, refreshAll]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Fetch comparison data when selectedChannel changes
  useEffect(() => {
    let isCurrent = true;
    eegApi.fetchChannelCompare(selectedChannel, 400, subject, recording).then(data => {
      if (isCurrent && data) {
        setComparisonData(data);
      }
    });
    return () => { isCurrent = false; };
  }, [selectedChannel, subject, recording]);

  // Fetch topomap data when selectedComponentId changes
  useEffect(() => {
    let isCurrent = true;
    analysisApi.fetchTopomap(selectedComponentId, subject, recording).then(data => {
      if (isCurrent && data) {
        setTopomapData(data);
      }
    });
    return () => { isCurrent = false; };
  }, [selectedComponentId, subject, recording]);

  const setSubject = useCallback((s: string) => {
    setSubjectState(s);
  }, []);

  const setRecording = useCallback((r: string) => {
    setRecordingState(r);
  }, []);

  const setSelectedChannel = useCallback((ch: string) => {
    setSelectedChannelState(ch);
  }, []);

  const setSelectedComponentId = useCallback((id: string) => {
    // Normalize format, e.g. IC09 -> IC9 or IC9 -> IC9
    const normalized = id.replace(/IC0*(\d+)/i, 'IC$1');
    setSelectedComponentIdState(normalized);
  }, []);

  const currentCompIndex = useMemo(() => {
    const idx = components.findIndex(c => c.component.toLowerCase() === selectedComponentId.toLowerCase());
    return idx >= 0 ? idx : 0;
  }, [components, selectedComponentId]);

  const nextComponent = useCallback(() => {
    if (components.length === 0) return;
    const nextIdx = (currentCompIndex + 1) % components.length;
    setSelectedComponentIdState(components[nextIdx].component);
  }, [components, currentCompIndex]);

  const prevComponent = useCallback(() => {
    if (components.length === 0) return;
    const prevIdx = (currentCompIndex - 1 + components.length) % components.length;
    setSelectedComponentIdState(components[prevIdx].component);
  }, [components, currentCompIndex]);

  const setHumanDecision = useCallback((comp: string, dec: DecisionType) => {
    setHumanDecisions(prev => ({ ...prev, [comp]: dec }));
    setComponents(prev => prev.map(c => {
      if (c.component.toLowerCase() === comp.toLowerCase()) {
        return {
          ...c,
          human_decision: dec,
          decision: dec,
        };
      }
      return c;
    }));
  }, []);

  const selectedComponent = useMemo(() => {
    const comp = components.find(c => c.component.toLowerCase() === selectedComponentId.toLowerCase()) || components[0] || null;
    if (!comp) return null;
    const userDec = humanDecisions[comp.component];
    if (userDec) {
      return {
        ...comp,
        decision: userDec,
        human_decision: userDec,
      };
    }
    return comp;
  }, [components, selectedComponentId, humanDecisions]);

  const runPipelineStage = useCallback(async (stageName: string) => {
    setIsProcessing(true);
    setProcessingStage(stageName);
    setProcessingProgress(10);

    for (let p = 20; p <= 100; p += 20) {
      await new Promise(r => setTimeout(r, 250));
      setProcessingProgress(p);
    }

    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStage('');

    // Advance workflow state if relevant
    if (stageName.toLowerCase().includes('ai')) {
      setWorkflowSteps(prev => prev.map(s => {
        if (s.id === 4) return { ...s, status: 'completed' };
        if (s.id === 5) return { ...s, status: 'in_progress' };
        return s;
      }));
    } else if (stageName.toLowerCase().includes('reconstruct')) {
      setWorkflowSteps(prev => prev.map(s => {
        if (s.id === 5) return { ...s, status: 'completed' };
        if (s.id === 6) return { ...s, status: 'in_progress' };
        return s;
      }));
    } else if (stageName.toLowerCase().includes('quality')) {
      setWorkflowSteps(prev => prev.map(s => {
        if (s.id === 6) return { ...s, status: 'completed' };
        return s;
      }));
    }
  }, []);

  const value = {
    subject,
    recording,
    session,
    subjects,
    recordings,
    channels,
    selectedChannel,
    components,
    selectedComponent,
    selectedComponentId,
    comparisonData,
    topomapData,
    quality,
    workflowSteps,
    activeRoute,
    is3D,
    cameraView,
    isLoading,
    isProcessing,
    processingProgress,
    processingStage,
    humanDecisions,
    setSubject,
    setRecording,
    setSelectedChannel,
    setSelectedComponentId,
    nextComponent,
    prevComponent,
    setHumanDecision,
    setActiveRoute,
    setIs3D,
    setCameraView,
    runPipelineStage,
    refreshAll,
    uploadedFile,
    uploadedFileName,
    setUploadedFile,
    runAnalysis,
  };

  return <NeuroContext.Provider value={value}>{children}</NeuroContext.Provider>;
};

export const useNeuro = (): NeuroContextType => {
  const context = useContext(NeuroContext);
  if (!context) {
    throw new Error('useNeuro must be used within a NeuroProvider');
  }
  return context;
};
