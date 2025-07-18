// Audio module specific types
export interface AudioControllerConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
}

export interface AudioProcessorConfig {
  fftSize: number;
  windowFunction: 'hann' | 'hamming' | 'blackman';
  hopSize: number;
}

// Live audio capture types
export interface LiveCaptureConfig {
  minDuration: number; // seconds
  maxDuration: number; // seconds
  sampleRate: number;
  channels: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentDuration: number;
  maxDuration: number;
  audioLevel: number; // 0-1 normalized level
}

export interface AudioLevelData {
  peak: number;      // Peak level (0-1)
  rms: number;       // RMS level (0-1)
  frequency: number; // Dominant frequency in Hz
}

export type RecordingStatus = 'idle' | 'requesting-permission' | 'recording' | 'paused' | 'completed' | 'error';

export interface LiveCaptureError {
  type: 'permission-denied' | 'device-not-found' | 'constraint-not-satisfied' | 'unknown';
  message: string;
  originalError?: Error;
}