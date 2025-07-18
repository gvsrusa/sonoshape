import { AudioProcessorConfig } from './types';
import { globalErrorHandler } from '../errors/ErrorHandler';
import { globalProgressManager, ProgressTracker } from '../errors/ProgressTracker';
import { ErrorCategory, ErrorSeverity } from '../errors/ErrorTypes';

export interface FrequencyData {
  frequencies: Float32Array[];
  timeStamps: number[];
  sampleRate: number;
  fftSize: number;
}

export interface AmplitudeData {
  envelope: Float32Array;
  timeStamps: number[];
  peak: number;
  rms: number;
}

export interface ProcessedFrame {
  frequencyData: Float32Array;
  amplitudeData: Float32Array;
  timestamp: number;
}

export interface AudioFeatures {
  frequencyData: Float32Array[];
  amplitudeEnvelope: Float32Array;
  spectralCentroid: Float32Array;
  spectralRolloff: Float32Array;
  zeroCrossingRate: Float32Array;
  mfcc: Float32Array[];
  tempo: number;
  beatTimes: number[];
  harmonicComplexity: Float32Array;
  key: string;
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;

  constructor(private config: AudioProcessorConfig = {
    fftSize: 2048,
    windowFunction: 'hann',
    hopSize: 512
  }) {}

  /**
   * Initialize audio context and analyser
   */
  private initializeAnalyser(audioContext: AudioContext): void {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
  }

  /**
   * Apply window function to audio data
   */
  private applyWindow(data: Float32Array): Float32Array {
    const windowed = new Float32Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      let windowValue = 1;
      
      switch (this.config.windowFunction) {
        case 'hann':
          windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (data.length - 1)));
          break;
        case 'hamming':
          windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (data.length - 1));
          break;
        case 'blackman':
          windowValue = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (data.length - 1)) + 
                       0.08 * Math.cos(4 * Math.PI * i / (data.length - 1));
          break;
      }
      
      windowed[i] = data[i] * windowValue;
    }
    
    return windowed;
  }

  /**
   * Perform FFT analysis on audio buffer with progress tracking
   */
  analyzeFrequencySpectrum(buffer: AudioBuffer, progressTracker?: ProgressTracker): FrequencyData {
    try {
      // Check memory usage before processing
      const memoryEstimate = globalErrorHandler.estimateMemoryUsage(buffer, 64);
      if (!memoryEstimate.safe) {
        throw globalErrorHandler.createMemoryLimitationError(
          'frequency spectrum analysis',
          memoryEstimate.estimated,
          memoryEstimate.available
        );
      }

      const channelData = buffer.getChannelData(0); // Use first channel
      const hopSize = this.config.hopSize;
      const fftSize = this.config.fftSize;
      const sampleRate = buffer.sampleRate;
      
      const frequencies: Float32Array[] = [];
      const timeStamps: number[] = [];
      
      const totalWindows = Math.floor((channelData.length - fftSize) / hopSize);
      let processedWindows = 0;
      
      // Process audio in overlapping windows
      for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
        // Check if operation was cancelled
        if (progressTracker?.isCancelled()) {
          throw globalErrorHandler.createError(
            ErrorCategory.AUDIO_PROCESSING,
            ErrorSeverity.MEDIUM,
            'OPERATION_CANCELLED',
            'Audio processing was cancelled by user'
          );
        }

        const window = channelData.slice(i, i + fftSize);
        const windowedData = this.applyWindow(window);
        
        // Perform FFT analysis
        const spectrum = this.computeFFT(windowedData);
        frequencies.push(spectrum);
        timeStamps.push(i / sampleRate);
        
        // Update progress
        processedWindows++;
        if (progressTracker && processedWindows % 10 === 0) {
          const progress = (processedWindows / totalWindows) * 100;
          progressTracker.updateStepProgress('frequency-analysis', progress, 
            `Analyzing frequency spectrum: ${processedWindows}/${totalWindows} windows`);
        }
      }
      
      return {
        frequencies,
        timeStamps,
        sampleRate,
        fftSize
      };
    } catch (error) {
      if (error instanceof Error) {
        globalErrorHandler.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Extract amplitude envelope from audio buffer
   */
  extractAmplitudeEnvelope(buffer: AudioBuffer): AmplitudeData {
    const channelData = buffer.getChannelData(0);
    const windowSize = Math.floor(buffer.sampleRate * 0.01); // 10ms windows
    const envelope = new Float32Array(Math.floor(channelData.length / windowSize));
    const timeStamps = new Float32Array(envelope.length);
    
    let peak = 0;
    let sumSquares = 0;
    
    for (let i = 0; i < envelope.length; i++) {
      const start = i * windowSize;
      const end = Math.min(start + windowSize, channelData.length);
      
      let windowMax = 0;
      let windowSumSquares = 0;
      
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        windowMax = Math.max(windowMax, abs);
        windowSumSquares += channelData[j] * channelData[j];
      }
      
      envelope[i] = windowMax;
      timeStamps[i] = start / buffer.sampleRate;
      peak = Math.max(peak, windowMax);
      sumSquares += windowSumSquares;
    }
    
    const rms = Math.sqrt(sumSquares / channelData.length);
    
    return {
      envelope,
      timeStamps: Array.from(timeStamps),
      peak,
      rms
    };
  }

  /**
   * Get temporal features from audio buffer
   */
  getTemporalFeatures(buffer: AudioBuffer): Partial<AudioFeatures> {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    // Calculate zero crossing rate
    const zcr = this.calculateZeroCrossingRate(channelData, sampleRate);
    
    // Calculate spectral features
    const frequencyData = this.analyzeFrequencySpectrum(buffer);
    const spectralCentroid = this.calculateSpectralCentroid(frequencyData);
    const spectralRolloff = this.calculateSpectralRolloff(frequencyData);
    
    // Advanced temporal pattern recognition
    const tempo = this.estimateTempo(buffer);
    const beatTimes = this.trackBeats(buffer, tempo);
    const harmonicComplexity = this.analyzeHarmonicContent(frequencyData);
    
    return {
      frequencyData: frequencyData.frequencies,
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate: zcr,
      tempo,
      beatTimes,
      harmonicComplexity,
      key: 'Unknown' // Key detection would require more complex analysis
    };
  }

  /**
   * Track beats for temporal mesh progression
   * Returns array of beat timestamps for rhythmic sculpture elements
   */
  trackBeats(buffer: AudioBuffer, tempo: number): number[] {
    if (tempo <= 0) return [];
    
    const beatInterval = 60 / tempo; // Seconds per beat
    const onsets = this.detectOnsets(buffer);
    
    if (onsets.length < 2) return [];
    
    // Align onsets to beat grid
    const beats: number[] = [];
    const startTime = onsets[0];
    const endTime = onsets[onsets.length - 1];
    
    // Generate theoretical beat times
    const theoreticalBeats: number[] = [];
    for (let time = startTime; time <= endTime; time += beatInterval) {
      theoreticalBeats.push(time);
    }
    
    // Match onsets to theoretical beats
    for (const theoreticalBeat of theoreticalBeats) {
      let closestOnset = onsets[0];
      let minDistance = Math.abs(onsets[0] - theoreticalBeat);
      
      for (const onset of onsets) {
        const distance = Math.abs(onset - theoreticalBeat);
        if (distance < minDistance && distance < beatInterval * 0.3) { // Within 30% of beat interval
          minDistance = distance;
          closestOnset = onset;
        }
      }
      
      if (minDistance < beatInterval * 0.3) {
        beats.push(closestOnset);
      }
    }
    
    return beats;
  }

  /**
   * Analyze harmonic content for surface texture complexity
   * Returns measure of harmonic richness that can influence sculpture texture
   */
  analyzeHarmonicContent(frequencyData: FrequencyData): Float32Array {
    const harmonicComplexity = new Float32Array(frequencyData.frequencies.length);
    
    for (let i = 0; i < frequencyData.frequencies.length; i++) {
      const spectrum = frequencyData.frequencies[i];
      
      // Find fundamental frequency (strongest peak)
      let maxMagnitude = 0;
      let fundamentalBin = 0;
      
      // Look for fundamental in typical range (80Hz - 800Hz)
      const minBin = Math.floor(80 * spectrum.length * 2 / frequencyData.sampleRate);
      const maxBin = Math.floor(800 * spectrum.length * 2 / frequencyData.sampleRate);
      
      for (let j = minBin; j < Math.min(maxBin, spectrum.length); j++) {
        if (spectrum[j] > maxMagnitude) {
          maxMagnitude = spectrum[j];
          fundamentalBin = j;
        }
      }
      
      if (fundamentalBin === 0 || maxMagnitude === 0) {
        harmonicComplexity[i] = 0;
        continue;
      }
      
      // Calculate harmonic-to-noise ratio and harmonic richness
      const fundamentalFreq = fundamentalBin * frequencyData.sampleRate / (2 * spectrum.length);
      let harmonicEnergy = 0;
      let totalEnergy = 0;
      let harmonicCount = 0;
      
      // Analyze first 10 harmonics
      for (let harmonic = 1; harmonic <= 10; harmonic++) {
        const harmonicFreq = fundamentalFreq * harmonic;
        const harmonicBin = Math.round(harmonicFreq * spectrum.length * 2 / frequencyData.sampleRate);
        
        if (harmonicBin >= spectrum.length) break;
        
        // Sum energy in a small window around the harmonic
        const windowSize = 3;
        let harmonicMagnitude = 0;
        
        for (let k = Math.max(0, harmonicBin - windowSize); 
             k <= Math.min(spectrum.length - 1, harmonicBin + windowSize); k++) {
          harmonicMagnitude += spectrum[k];
        }
        
        if (harmonicMagnitude > maxMagnitude * 0.1) { // Significant harmonic
          harmonicEnergy += harmonicMagnitude;
          harmonicCount++;
        }
      }
      
      // Calculate total spectral energy
      for (let j = 0; j < spectrum.length; j++) {
        totalEnergy += spectrum[j];
      }
      
      // Harmonic complexity combines harmonic count and harmonic-to-total energy ratio
      const harmonicRatio = totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
      harmonicComplexity[i] = harmonicCount * harmonicRatio;
    }
    
    return harmonicComplexity;
  }

  /**
   * Process real-time audio data
   */
  processRealTime(audioData: Float32Array): ProcessedFrame {
    const windowed = this.applyWindow(audioData);
    const frequencyData = this.computeFFT(windowed);
    const amplitudeData = new Float32Array(audioData.length);
    
    // Calculate amplitude data
    for (let i = 0; i < audioData.length; i++) {
      amplitudeData[i] = Math.abs(audioData[i]);
    }
    
    return {
      frequencyData,
      amplitudeData,
      timestamp: Date.now()
    };
  }

  /**
   * Connect to audio source for real-time analysis
   */
  connectToAudioSource(audioContext: AudioContext, source: AudioNode): void {
    this.initializeAnalyser(audioContext);
    if (this.analyser) {
      source.connect(this.analyser);
      // Connect analyser to destination to enable audio processing
      this.analyser.connect(audioContext.destination);
    }
  }

  /**
   * Get current frequency data from analyser
   */
  getCurrentFrequencyData(): Uint8Array | null {
    if (this.analyser && this.frequencyData) {
      this.analyser.getByteFrequencyData(this.frequencyData);
      return this.frequencyData;
    }
    return null;
  }

  /**
   * Get current time domain data from analyser
   */
  getCurrentTimeData(): Uint8Array | null {
    if (this.analyser && this.timeData) {
      this.analyser.getByteTimeDomainData(this.timeData);
      return this.timeData;
    }
    return null;
  }

  /**
   * Simplified FFT computation (for demonstration - in production, use Web Audio API)
   */
  private computeFFT(data: Float32Array): Float32Array {
    const N = data.length;
    const spectrum = new Float32Array(N / 2);
    
    // This is a simplified DFT for demonstration
    // In production, use Web Audio API's AnalyserNode or a proper FFT library
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += data[n] * Math.cos(angle);
        imag += data[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Calculate zero crossing rate (texture variation measure)
   * Higher values indicate more noisy/textured content, lower values indicate tonal content
   */
  private calculateZeroCrossingRate(data: Float32Array, sampleRate: number): Float32Array {
    const windowSize = Math.floor(sampleRate * 0.025); // 25ms windows
    const hopSize = Math.floor(windowSize / 2); // 50% overlap
    const numFrames = Math.floor((data.length - windowSize) / hopSize) + 1;
    const zcr = new Float32Array(numFrames);
    
    for (let i = 0; i < numFrames; i++) {
      const start = i * hopSize;
      const end = Math.min(start + windowSize, data.length - 1);
      let crossings = 0;
      
      // Apply pre-emphasis to reduce low-frequency noise
      let prevSample = data[start];
      for (let j = start + 1; j < end; j++) {
        const currentSample = data[j] - 0.97 * prevSample; // Pre-emphasis filter
        const prevProcessed = data[j - 1] - 0.97 * data[Math.max(0, j - 2)];
        
        if ((prevProcessed >= 0) !== (currentSample >= 0)) {
          crossings++;
        }
        prevSample = data[j];
      }
      
      // Normalize by window size and convert to rate per second
      zcr[i] = (crossings / (end - start)) * sampleRate;
    }
    
    return zcr;
  }

  /**
   * Calculate spectral centroid (brightness measure)
   * Higher values indicate brighter, more high-frequency content
   */
  private calculateSpectralCentroid(frequencyData: FrequencyData): Float32Array {
    const centroids = new Float32Array(frequencyData.frequencies.length);
    
    for (let i = 0; i < frequencyData.frequencies.length; i++) {
      const spectrum = frequencyData.frequencies[i];
      let weightedSum = 0;
      let magnitudeSum = 0;
      
      for (let j = 1; j < spectrum.length; j++) { // Skip DC component
        const frequency = j * frequencyData.sampleRate / (2 * spectrum.length);
        const magnitude = spectrum[j];
        weightedSum += frequency * magnitude;
        magnitudeSum += magnitude;
      }
      
      centroids[i] = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    return centroids;
  }

  /**
   * Calculate spectral rolloff (high-frequency content measure)
   * Frequency below which a specified percentage of total spectral energy lies
   */
  private calculateSpectralRolloff(frequencyData: FrequencyData, threshold: number = 0.85): Float32Array {
    const rolloffs = new Float32Array(frequencyData.frequencies.length);
    
    for (let i = 0; i < frequencyData.frequencies.length; i++) {
      const spectrum = frequencyData.frequencies[i];
      
      // Calculate total spectral energy (skip DC component)
      let totalEnergy = 0;
      for (let j = 1; j < spectrum.length; j++) {
        totalEnergy += spectrum[j] * spectrum[j]; // Use power spectrum
      }
      
      if (totalEnergy === 0) {
        rolloffs[i] = 0;
        continue;
      }
      
      const targetEnergy = totalEnergy * threshold;
      let cumulativeEnergy = 0;
      let rolloffBin = 0;
      
      for (let j = 1; j < spectrum.length; j++) {
        cumulativeEnergy += spectrum[j] * spectrum[j];
        if (cumulativeEnergy >= targetEnergy) {
          rolloffBin = j;
          break;
        }
      }
      
      // Convert bin to frequency
      rolloffs[i] = rolloffBin * frequencyData.sampleRate / (2 * spectrum.length);
    }
    
    return rolloffs;
  }

  /**
   * Estimate tempo using improved beat detection algorithm
   * Implements autocorrelation-based tempo detection for rhythmic sculpture elements
   */
  private estimateTempo(buffer: AudioBuffer): number {
    const amplitudeData = this.extractAmplitudeEnvelope(buffer);
    const envelope = amplitudeData.envelope;
    
    if (envelope.length < 100) return 0; // Too short for tempo analysis
    
    // Apply onset detection using spectral flux
    const onsets = this.detectOnsets(buffer);
    
    if (onsets.length < 4) {
      // Fallback to simple peak detection
      return this.simpleTempoDetection(envelope, amplitudeData.timeStamps);
    }
    
    // Use autocorrelation to find periodic patterns
    return this.autocorrelationTempo(onsets);
  }

  /**
   * Detect onsets in audio using spectral flux
   */
  private detectOnsets(buffer: AudioBuffer): number[] {
    const frequencyData = this.analyzeFrequencySpectrum(buffer);
    const onsets: number[] = [];
    
    if (frequencyData.frequencies.length < 2) return onsets;
    
    // Calculate spectral flux (measure of spectral change)
    const flux: number[] = [];
    for (let i = 1; i < frequencyData.frequencies.length; i++) {
      const current = frequencyData.frequencies[i];
      const previous = frequencyData.frequencies[i - 1];
      
      let spectralFlux = 0;
      for (let j = 0; j < Math.min(current.length, previous.length); j++) {
        const diff = current[j] - previous[j];
        spectralFlux += Math.max(0, diff); // Half-wave rectification
      }
      flux.push(spectralFlux);
    }
    
    // Peak picking in spectral flux
    const threshold = this.calculateAdaptiveThreshold(flux);
    for (let i = 1; i < flux.length - 1; i++) {
      if (flux[i] > threshold && 
          flux[i] > flux[i - 1] && 
          flux[i] > flux[i + 1]) {
        onsets.push(frequencyData.timeStamps[i + 1]);
      }
    }
    
    return onsets;
  }

  /**
   * Calculate adaptive threshold for onset detection
   */
  private calculateAdaptiveThreshold(flux: number[]): number {
    const mean = flux.reduce((sum, val) => sum + val, 0) / flux.length;
    const variance = flux.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / flux.length;
    const stdDev = Math.sqrt(variance);
    
    return mean + 2 * stdDev; // Threshold at 2 standard deviations above mean
  }

  /**
   * Simple tempo detection fallback
   */
  private simpleTempoDetection(envelope: Float32Array, timeStamps: number[]): number {
    const peaks: number[] = [];
    
    // Find maximum value in envelope
    let maxValue = 0;
    for (let i = 0; i < envelope.length; i++) {
      if (envelope[i] > maxValue) {
        maxValue = envelope[i];
      }
    }
    const threshold = maxValue * 0.6;
    
    for (let i = 1; i < envelope.length - 1; i++) {
      if (envelope[i] > threshold && 
          envelope[i] > envelope[i - 1] && 
          envelope[i] > envelope[i + 1]) {
        peaks.push(timeStamps[i]);
      }
    }
    
    if (peaks.length < 2) return 0;
    
    const intervals = peaks.slice(1).map((peak, i) => peak - peaks[i]);
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    return avgInterval > 0 ? 60 / avgInterval : 0;
  }

  /**
   * Autocorrelation-based tempo detection
   */
  private autocorrelationTempo(onsets: number[]): number {
    if (onsets.length < 4) return 0;
    
    // Create onset strength signal
    const duration = onsets[onsets.length - 1] - onsets[0];
    const sampleRate = 100; // 10ms resolution
    const signal = new Float32Array(Math.floor(duration * sampleRate));
    
    // Convert onsets to impulse train
    for (const onset of onsets) {
      const index = Math.floor((onset - onsets[0]) * sampleRate);
      if (index >= 0 && index < signal.length) {
        signal[index] = 1;
      }
    }
    
    // Compute autocorrelation
    const maxLag = Math.min(signal.length / 2, sampleRate * 2); // Max 2 seconds
    const autocorr = new Float32Array(maxLag);
    
    for (let lag = 1; lag < maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < signal.length - lag; i++) {
        sum += signal[i] * signal[i + lag];
      }
      autocorr[lag] = sum;
    }
    
    // Find peak in autocorrelation (corresponds to beat period)
    let maxCorr = 0;
    let bestLag = 0;
    const minBPM = 60; // Minimum 60 BPM
    const maxBPM = 200; // Maximum 200 BPM
    const minLag = Math.floor(60 * sampleRate / maxBPM);
    const maxLagSearch = Math.floor(60 * sampleRate / minBPM);
    
    for (let lag = minLag; lag < Math.min(maxLagSearch, autocorr.length); lag++) {
      if (autocorr[lag] > maxCorr) {
        maxCorr = autocorr[lag];
        bestLag = lag;
      }
    }
    
    return bestLag > 0 ? 60 * sampleRate / bestLag : 0;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    this.audioContext = null;
    this.frequencyData = null;
    this.timeData = null;
  }
}