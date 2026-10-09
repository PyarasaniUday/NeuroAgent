export type DecisionType = 'KEEP' | 'REMOVE' | 'REVIEW';

export interface EEGSession {
  session_id: string;
  subject: string;
  recording: string;
  channels: number;
  sampling_rate: number;
  duration: number;
  ica_components: number;
  files: Record<string, boolean>;
}

export interface ICAComponent {
  component: string;
  iclabel_label: string;
  iclabel_confidence: number;
  artifact_score: number;
  brain_score: number;
  decision: DecisionType;
  neuroagent_decision: DecisionType;
  human_decision?: DecisionType;
  neuroagent_reason: string;
  dominant_frequency?: number;
  explained_variance?: number;
  signal_quality?: string;
  total_power?: number;
  delta_relative?: number;
  theta_relative?: number;
  alpha_relative?: number;
  beta_relative?: number;
  gamma_relative?: number;
}

export interface ChannelInfo {
  index: number;
  name: string;
  status: 'clean' | 'artifact' | 'review';
  x: number;
  y: number;
  z: number;
}

export interface ChannelComparisonData {
  channel: string;
  channel_index: number;
  sfreq: number;
  duration: number;
  times: number[];
  before_eeg: number[];
  after_eeg: number[];
  unit: string;
  raw_std: number;
  clean_std: number;
  reduction_pct: number;
  psd_freqs: number[];
  psd_raw: number[];
  psd_clean: number[];
  available: boolean;
}

export interface TopomapData {
  component: string;
  channels: {
    channel: string;
    index: number;
    weight: number;
    raw_weight?: number;
    x: number;
    y: number;
    z: number;
  }[];
  min_weight: number;
  max_weight: number;
  available: boolean;
}

export interface QualityReport {
  overall_quality: string;
  components_removed: number;
  components_kept: number;
  components_review: number;
  delta_change_percent?: number;
  theta_change_percent?: number;
  alpha_change_percent?: number;
  beta_change_percent?: number;
  gamma_change_percent?: number;
  original_rms?: number;
  clean_rms?: number;
  raw?: { metric: string; value: string }[];
}

export interface TrainingMetrics {
  evaluation_file?: string;
  total_windows?: number;
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  weighted_f1: number;
  confusion_matrix: number[][];
  classes?: Record<string, string>;
}

export interface WorkflowStep {
  id: number;
  title: string;
  status: 'completed' | 'in_progress' | 'pending';
  path: string;
}

export interface HistoryRecord {
  id: string;
  filename: string;
  filesize: string;
  subject: string;
  recording: string;
  uploadedAt: string;
  analyzedAt?: string;
  status: 'Cleaned' | 'Analyzed' | 'Ready' | 'Processing';
  channels: number;
  samplingRate: number;
  duration: number;
  artifactsDetected: number;
  noiseReduction: number;
  qualityScore: number;
  qualityStatus: string;
  cleanRms?: number;
  rawRms?: number;
  flaggedComponents?: string[];
  summary?: string;
}
