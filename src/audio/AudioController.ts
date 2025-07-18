import { 
  AudioControllerConfig, 
  LiveCaptureConfig, 
  RecordingState, 
  AudioLevelData, 
  RecordingStatus, 
  LiveCaptureError 
} from './types';
import { globalErrorHandler } from '../errors/ErrorHandler';
import { ErrorCategory, ErrorSeverity } from '../errors/ErrorTypes';

export interface AudioFileInfo {
  name: string;
  size: number;
  duration: number;
  sampleRate: number;
  channels: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export class AudioController {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPlaying: boolean = false;
  private onTimeUpdateCallback: ((currentTime: number) => void) | null = null;
  private animationFrameId: number | null = null;

  // Live capture properties
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime: number = 0;
  private recordingStatus: RecordingStatus = 'idle';
  private recordingTimer: number | null = null;
  private levelAnalyzer: AnalyserNode | null = null;
  private levelMonitorId: number | null = null;
  private onRecordingStateChange: ((state: RecordingState) => void) | null = null;
  private onAudioLevelUpdate: ((level: AudioLevelData) => void) | null = null;
  private onRecordingError: ((error: LiveCaptureError) => void) | null = null;

  private readonly supportedFormats = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/m4a'];
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB limit
  
  private readonly liveCaptureConfig: LiveCaptureConfig = {
    minDuration: 5,
    maxDuration: 120,
    sampleRate: 44100,
    channels: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };

  constructor(private config: AudioControllerConfig = {
    sampleRate: 44100,
    bufferSize: 2048,
    channels: 2
  }) {}

  /**
   * Initialize the Web Audio API context
   */
  private async initializeAudioContext(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Validate audio file format and size
   */
  private validateAudioFile(file: File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      const memoryError = globalErrorHandler.createError(
        ErrorCategory.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'FILE_SIZE_EXCEEDED',
        `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${this.maxFileSize / 1024 / 1024}MB)`,
        [
          {
            type: 'manual',
            label: 'Use Smaller File',
            description: 'Select a smaller audio file or compress the current one',
            action: () => {}
          },
          {
            type: 'manual',
            label: 'Trim Audio',
            description: 'Use audio editing software to trim the file to a shorter duration',
            action: () => {}
          }
        ],
        [
          {
            title: 'Compress Audio File',
            description: 'Use audio compression tools to reduce file size while maintaining quality'
          },
          {
            title: 'Trim Duration',
            description: 'Select a shorter segment of the audio file (recommended: under 2 minutes)'
          }
        ],
        { fileSize: file.size, maxSize: this.maxFileSize, fileName: file.name }
      );
      throw memoryError;
    }

    // Check file type
    const isValidFormat = this.supportedFormats.some(format => 
      file.type === format || 
      file.name.toLowerCase().endsWith(format.split('/')[1]) ||
      (format === 'audio/mp4' && file.name.toLowerCase().endsWith('.m4a'))
    );

    if (!isValidFormat) {
      const formatError = globalErrorHandler.createAudioFormatError(
        new Error('Unsupported format'),
        file.name,
        file.type || 'unknown',
        ['MP3', 'WAV', 'FLAC', 'M4A']
      );
      throw formatError;
    }
  }

  /**
   * Load and decode audio file
   */
  async loadAudioFile(file: File): Promise<AudioFileInfo> {
    try {
      this.validateAudioFile(file);
      await this.initializeAudioContext();

      const arrayBuffer = await file.arrayBuffer();
      
      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const fileInfo: AudioFileInfo = {
        name: file.name,
        size: file.size,
        duration: this.audioBuffer.duration,
        sampleRate: this.audioBuffer.sampleRate,
        channels: this.audioBuffer.numberOfChannels
      };

      return fileInfo;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'EncodingError') {
          throw new Error('Unable to decode audio file. The file may be corrupted or in an unsupported format.');
        }
        throw error;
      }
      throw new Error('Unknown error occurred while loading audio file');
    }
  }

  /**
   * Start audio playback
   */
  async playAudio(onTimeUpdate?: (currentTime: number) => void): Promise<void> {
    if (!this.audioBuffer || !this.audioContext) {
      throw new Error('No audio file loaded');
    }

    await this.initializeAudioContext();

    // Stop any existing playback
    this.stopAudio();

    // Create audio source and gain node
    this.audioSource = this.audioContext.createBufferSource();
    this.gainNode = this.audioContext.createGain();
    
    this.audioSource.buffer = this.audioBuffer;
    this.audioSource.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Set up time update callback
    this.onTimeUpdateCallback = onTimeUpdate || null;

    // Handle playback end
    this.audioSource.onended = () => {
      this.isPlaying = false;
      this.startTime = 0;
      this.pauseTime = 0;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    };

    // Start playback
    this.startTime = this.audioContext.currentTime - this.pauseTime;
    this.audioSource.start(0, this.pauseTime);
    this.isPlaying = true;

    // Start time update loop
    this.updateTime();
  }

  /**
   * Pause audio playback
   */
  pauseAudio(): void {
    if (this.audioSource && this.isPlaying) {
      this.audioSource.stop();
      this.pauseTime = this.getCurrentTime();
      this.isPlaying = false;
      
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  }

  /**
   * Stop audio playback
   */
  stopAudio(): void {
    if (this.audioSource) {
      this.audioSource.stop();
      this.audioSource.disconnect();
      this.audioSource = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    this.isPlaying = false;
    this.startTime = 0;
    this.pauseTime = 0;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Seek to specific time in audio
   */
  async seekTo(time: number): Promise<void> {
    if (!this.audioBuffer) {
      throw new Error('No audio file loaded');
    }

    const clampedTime = Math.max(0, Math.min(time, this.audioBuffer.duration));
    const wasPlaying = this.isPlaying;

    this.stopAudio();
    this.pauseTime = clampedTime;

    if (wasPlaying) {
      await this.playAudio(this.onTimeUpdateCallback || undefined);
    }
  }

  /**
   * Set playback volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.gainNode.gain.setValueAtTime(clampedVolume, this.audioContext?.currentTime || 0);
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this.audioBuffer) {
      return 0;
    }

    if (this.isPlaying) {
      return Math.min(
        this.audioContext.currentTime - this.startTime,
        this.audioBuffer.duration
      );
    }

    return this.pauseTime;
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: this.audioBuffer?.duration || 0
    };
  }

  /**
   * Get the loaded audio buffer
   */
  getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  /**
   * Check if audio is loaded
   */
  isAudioLoaded(): boolean {
    return this.audioBuffer !== null;
  }

  /**
   * Update time and call callback
   */
  private updateTime(): void {
    if (this.isPlaying && this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.getCurrentTime());
      this.animationFrameId = requestAnimationFrame(() => this.updateTime());
    }
  }

  /**
   * Request microphone access and start live audio capture
   */
  async startLiveCapture(
    duration: number,
    onStateChange?: (state: RecordingState) => void,
    onLevelUpdate?: (level: AudioLevelData) => void,
    onError?: (error: LiveCaptureError) => void
  ): Promise<AudioBuffer> {
    // Validate duration
    if (duration < this.liveCaptureConfig.minDuration || duration > this.liveCaptureConfig.maxDuration) {
      throw new Error(`Recording duration must be between ${this.liveCaptureConfig.minDuration} and ${this.liveCaptureConfig.maxDuration} seconds`);
    }

    // Set callbacks
    this.onRecordingStateChange = onStateChange || null;
    this.onAudioLevelUpdate = onLevelUpdate || null;
    this.onRecordingError = onError || null;

    try {
      this.recordingStatus = 'requesting-permission';
      this.notifyStateChange();

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.liveCaptureConfig.sampleRate,
          channelCount: this.liveCaptureConfig.channels,
          echoCancellation: this.liveCaptureConfig.echoCancellation,
          noiseSuppression: this.liveCaptureConfig.noiseSuppression,
          autoGainControl: this.liveCaptureConfig.autoGainControl
        }
      });

      await this.initializeAudioContext();
      
      // Set up audio level monitoring
      await this.setupLevelMonitoring();

      // Set up MediaRecorder
      this.setupMediaRecorder();

      // Start recording
      this.recordedChunks = [];
      this.recordingStartTime = Date.now();
      this.recordingStatus = 'recording';
      this.mediaRecorder!.start();

      // Set up recording timer
      this.setupRecordingTimer(duration);

      this.notifyStateChange();
      this.startLevelMonitoring();

      // Return promise that resolves when recording is complete
      return new Promise((resolve, reject) => {
        const originalOnError = this.onRecordingError;
        this.onRecordingError = (error) => {
          if (originalOnError) originalOnError(error);
          reject(new Error(error.message));
        };

        this.mediaRecorder!.onstop = async () => {
          try {
            const audioBuffer = await this.processRecordedAudio();
            this.cleanupLiveCapture();
            resolve(audioBuffer);
          } catch (error) {
            this.cleanupLiveCapture();
            reject(error);
          }
        };
      });

    } catch (error) {
      const captureError = this.createLiveCaptureError(error);
      this.recordingStatus = 'error';
      this.notifyError(captureError);
      this.cleanupLiveCapture();
      throw new Error(captureError.message);
    }
  }

  /**
   * Stop live audio capture
   */
  stopLiveCapture(): void {
    if (this.mediaRecorder && this.recordingStatus === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Pause live audio capture
   */
  pauseLiveCapture(): void {
    if (this.mediaRecorder && this.recordingStatus === 'recording') {
      this.mediaRecorder.pause();
      this.recordingStatus = 'paused';
      this.notifyStateChange();
    }
  }

  /**
   * Resume live audio capture
   */
  resumeLiveCapture(): void {
    if (this.mediaRecorder && this.recordingStatus === 'paused') {
      this.mediaRecorder.resume();
      this.recordingStatus = 'recording';
      this.notifyStateChange();
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState(): RecordingState {
    const currentDuration = this.recordingStatus === 'recording' || this.recordingStatus === 'paused' 
      ? (Date.now() - this.recordingStartTime) / 1000 
      : 0;

    return {
      isRecording: this.recordingStatus === 'recording',
      isPaused: this.recordingStatus === 'paused',
      currentDuration,
      maxDuration: this.liveCaptureConfig.maxDuration,
      audioLevel: this.getCurrentAudioLevel()
    };
  }

  /**
   * Check if microphone access is supported
   */
  isLiveCaptureSupported(): boolean {
    return !!(navigator.mediaDevices && 
              typeof navigator.mediaDevices.getUserMedia === 'function' && 
              window.MediaRecorder);
  }

  /**
   * Set up MediaRecorder
   */
  private setupMediaRecorder(): void {
    if (!this.mediaStream) {
      throw new Error('Media stream not available');
    }

    // Choose the best available audio format
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];

    let selectedMimeType = '';
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }

    if (!selectedMimeType) {
      throw new Error('No supported audio recording format found');
    }

    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: selectedMimeType,
      audioBitsPerSecond: 128000
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
  }

  /**
   * Set up audio level monitoring
   */
  private async setupLevelMonitoring(): Promise<void> {
    if (!this.mediaStream || !this.audioContext) {
      return;
    }

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.levelAnalyzer = this.audioContext.createAnalyser();
    this.levelAnalyzer.fftSize = 256;
    this.levelAnalyzer.smoothingTimeConstant = 0.8;

    source.connect(this.levelAnalyzer);
  }

  /**
   * Start monitoring audio levels
   */
  private startLevelMonitoring(): void {
    if (!this.levelAnalyzer) {
      return;
    }

    const bufferLength = this.levelAnalyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(this.levelAnalyzer.fftSize);

    const updateLevels = () => {
      if (this.recordingStatus !== 'recording' && this.recordingStatus !== 'paused') {
        return;
      }

      this.levelAnalyzer!.getByteFrequencyData(dataArray);
      this.levelAnalyzer!.getByteTimeDomainData(timeDataArray);

      // Calculate RMS level
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < timeDataArray.length; i++) {
        const sample = (timeDataArray[i] - 128) / 128;
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      const rms = Math.sqrt(sum / timeDataArray.length);

      // Find dominant frequency
      let maxIndex = 0;
      let maxValue = 0;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > maxValue) {
          maxValue = dataArray[i];
          maxIndex = i;
        }
      }
      const frequency = (maxIndex * this.audioContext!.sampleRate) / (2 * dataArray.length);

      const levelData: AudioLevelData = {
        peak,
        rms,
        frequency
      };

      if (this.onAudioLevelUpdate) {
        this.onAudioLevelUpdate(levelData);
      }

      this.levelMonitorId = requestAnimationFrame(updateLevels);
    };

    updateLevels();
  }

  /**
   * Set up recording timer
   */
  private setupRecordingTimer(duration: number): void {
    this.recordingTimer = window.setTimeout(() => {
      this.stopLiveCapture();
    }, duration * 1000);
  }

  /**
   * Process recorded audio data
   */
  private async processRecordedAudio(): Promise<AudioBuffer> {
    if (this.recordedChunks.length === 0) {
      throw new Error('No audio data recorded');
    }

    const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
    const arrayBuffer = await audioBlob.arrayBuffer();

    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Set the recorded audio as the current audio buffer
      this.audioBuffer = audioBuffer;
      
      return audioBuffer;
    } catch (error) {
      throw new Error('Failed to decode recorded audio data');
    }
  }

  /**
   * Get current audio level (0-1)
   */
  private getCurrentAudioLevel(): number {
    if (!this.levelAnalyzer) {
      return 0;
    }

    const dataArray = new Uint8Array(this.levelAnalyzer.fftSize);
    this.levelAnalyzer.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const sample = (dataArray[i] - 128) / 128;
      sum += sample * sample;
    }

    return Math.sqrt(sum / dataArray.length);
  }

  /**
   * Create live capture error object
   */
  private createLiveCaptureError(error: any): LiveCaptureError {
    if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
      return {
        type: 'permission-denied',
        message: 'Microphone access was denied. Please allow microphone access and try again.',
        originalError: error
      };
    }

    if (error?.name === 'NotFoundError' || error?.name === 'DeviceNotFoundError') {
      return {
        type: 'device-not-found',
        message: 'No microphone device found. Please connect a microphone and try again.',
        originalError: error
      };
    }

    if (error?.name === 'OverconstrainedError' || error?.name === 'ConstraintNotSatisfiedError') {
      return {
        type: 'constraint-not-satisfied',
        message: 'Microphone does not support the required audio settings. Try with different settings.',
        originalError: error
      };
    }

    return {
      type: 'unknown',
      message: error?.message || 'An unknown error occurred during audio capture.',
      originalError: error
    };
  }

  /**
   * Notify recording state change
   */
  private notifyStateChange(): void {
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange(this.getRecordingState());
    }
  }

  /**
   * Notify recording error
   */
  private notifyError(error: LiveCaptureError): void {
    if (this.onRecordingError) {
      this.onRecordingError(error);
    }
  }

  /**
   * Clean up live capture resources
   */
  private cleanupLiveCapture(): void {
    // Stop level monitoring
    if (this.levelMonitorId) {
      cancelAnimationFrame(this.levelMonitorId);
      this.levelMonitorId = null;
    }

    // Clear recording timer
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Disconnect level analyzer
    if (this.levelAnalyzer) {
      this.levelAnalyzer.disconnect();
      this.levelAnalyzer = null;
    }

    // Reset MediaRecorder
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStatus = 'idle';
    this.recordingStartTime = 0;

    // Clear callbacks
    this.onRecordingStateChange = null;
    this.onAudioLevelUpdate = null;
    this.onRecordingError = null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAudio();
    this.cleanupLiveCapture();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.audioContext = null;
    this.audioBuffer = null;
  }
}