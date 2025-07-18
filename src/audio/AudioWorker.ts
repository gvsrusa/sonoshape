/**
 * Web Worker for audio processing to prevent UI blocking
 * Handles heavy audio analysis operations in a separate thread
 */

import { AudioFeatures, FrequencyData, AmplitudeData, ProcessedFrame } from './types';

export interface AudioWorkerMessage {
  type: 'ANALYZE_AUDIO' | 'PROCESS_REALTIME' | 'EXTRACT_FEATURES';
  data: {
    audioBuffer?: ArrayBuffer;
    sampleRate?: number;
    channelData?: Float32Array;
    config?: AudioProcessorConfig;
    progressId?: string;
  };
}

export interface AudioWorkerResponse {
  type: 'ANALYSIS_COMPLETE' | 'REALTIME_FRAME' | 'FEATURES_EXTRACTED' | 'PROGRESS_UPDATE' | 'ERROR';
  data: {
    result?: AudioFeatures | ProcessedFrame | FrequencyData | AmplitudeData;
    progress?: number;
    progressId?: string;
    error?: string;
    message?: string;
  };
}

interface AudioProcessorConfig {
  fftSize: number;
  windowFunction: 'hann' | 'hamming' | 'blackman';
  hopSize: number;
}

class AudioWorkerProcessor {
  private config: AudioProcessorConfig = {
    fftSize: 2048,
    windowFunction: 'hann',
    hopSize: 512
  };

  constructor() {
    // Listen for messages from main thread
    self.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent<AudioWorkerMessage>): void {
    const { type, data } = event.data;

    try {
      switch (type) {
        case 'ANALYZE_AUDIO':
          this.analyzeAudio(data);
          break;
        case 'PROCESS_REALTIME':
          this.processRealtime(data);
          break;
        case 'EXTRACT_FEATURES':
          this.extractFeatures(data);
          break;
        default:
          this.postError(`Unknown message type: ${type}`);
      }
    } catch (error) {
      this.postError(`Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeAudio(data: AudioWorkerMessage['data']): Promise<void> {
    if (!data.audioBuffer || !data.sampleRate) {
      this.postError('Missing audio buffer or sample rate');
      return;
    }

    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }

    // Convert ArrayBuffer to Float32Array
    const channelData = new Float32Array(data.audioBuffer);
    const sampleRate = data.sampleRate;

    // Analyze frequency spectrum with progress updates
    const frequencyData = await this.analyzeFrequencySpectrum(channelData, sampleRate, data.progressId);
    
    // Extract amplitude envelope
    const amplitudeData = this.extractAmplitudeEnvelope(channelData, sampleRate);
    
    // Calculate temporal features
    const temporalFeatures = await this.getTemporalFeatures(channelData, sampleRate, frequencyData);

    const audioFeatures: AudioFeatures = {
      frequencyData: frequencyData.frequencies,
      amplitudeEnvelope: amplitudeData.envelope,
      spectralCentroid: temporalFeatures.spectralCentroid,
      spectralRolloff: temporalFeatures.spectralRolloff,
      zeroCrossingRate: temporalFeatures.zeroCrossingRate,
      mfcc: temporalFeatures.mfcc,
      tempo: temporalFeatures.tempo,
      beatTimes: temporalFeatures.beatTimes,
      harmonicComplexity: temporalFeatures.harmonicComplexity,
      key: 'Unknown'
    };

    this.postMessage({
      type: 'ANALYSIS_COMPLETE',
      data: { result: audioFeatures, progressId: data.progressId }
    });
  }

  private processRealtime(data: AudioWorkerMessage['data']): void {
    if (!data.channelData) {
      this.postError('Missing channel data for real-time processing');
      return;
    }

    const windowed = this.applyWindow(data.channelData);
    const frequencyData = this.computeFFT(windowed);
    const amplitudeData = new Float32Array(data.channelData.length);

    // Calculate amplitude data
    for (let i = 0; i < data.channelData.length; i++) {
      amplitudeData[i] = Math.abs(data.channelData[i]);
    }

    const processedFrame: ProcessedFrame = {
      frequencyData,
      amplitudeData,
      timestamp: Date.now()
    };

    this.postMessage({
      type: 'REALTIME_FRAME',
      data: { result: processedFrame }
    });
  }

  private async extractFeatures(data: AudioWorkerMessage['data']): Promise<void> {
    if (!data.audioBuffer || !data.sampleRate) {
      this.postError('Missing audio buffer or sample rate for feature extraction');
      return;
    }

    const channelData = new Float32Array(data.audioBuffer);
    const sampleRate = data.sampleRate;

    const frequencyData = await this.analyzeFrequencySpectrum(channelData, sampleRate, data.progressId);
    const temporalFeatures = await this.getTemporalFeatures(channelData, sampleRate, frequencyData);

    this.postMessage({
      type: 'FEATURES_EXTRACTED',
      data: { result: temporalFeatures, progressId: data.progressId }
    });
  }

  private async analyzeFrequencySpectrum(
    channelData: Float32Array, 
    sampleRate: number, 
    progressId?: string
  ): Promise<FrequencyData> {
    const hopSize = this.config.hopSize;
    const fftSize = this.config.fftSize;
    
    const frequencies: Float32Array[] = [];
    const timeStamps: number[] = [];
    
    const totalWindows = Math.floor((channelData.length - fftSize) / hopSize);
    let processedWindows = 0;
    
    // Process audio in overlapping windows
    for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
      const window = channelData.slice(i, i + fftSize);
      const windowedData = this.applyWindow(window);
      
      // Perform FFT analysis
      const spectrum = this.computeFFT(windowedData);
      frequencies.push(spectrum);
      timeStamps.push(i / sampleRate);
      
      // Update progress every 50 windows to avoid too many messages
      processedWindows++;
      if (progressId && processedWindows % 50 === 0) {
        const progress = (processedWindows / totalWindows) * 100;
        this.postMessage({
          type: 'PROGRESS_UPDATE',
          data: { 
            progress, 
            progressId,
            message: `Analyzing frequency spectrum: ${processedWindows}/${totalWindows} windows`
          }
        });
      }

      // Yield control periodically to prevent blocking
      if (processedWindows % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return {
      frequencies,
      timeStamps,
      sampleRate,
      fftSize
    };
  }

  private extractAmplitudeEnvelope(channelData: Float32Array, sampleRate: number): AmplitudeData {
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
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
      timeStamps[i] = start / sampleRate;
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

  private async getTemporalFeatures(
    channelData: Float32Array, 
    sampleRate: number, 
    frequencyData: FrequencyData
  ): Promise<Partial<AudioFeatures>> {
    // Calculate zero crossing rate
    const zcr = this.calculateZeroCrossingRate(channelData, sampleRate);
    
    // Calculate spectral features
    const spectralCentroid = this.calculateSpectralCentroid(frequencyData);
    const spectralRolloff = this.calculateSpectralRolloff(frequencyData);
    
    // Advanced temporal pattern recognition
    const tempo = await this.estimateTempo(channelData, sampleRate);
    const beatTimes = this.trackBeats(channelData, sampleRate, tempo);
    const harmonicComplexity = this.analyzeHarmonicContent(frequencyData);
    
    // Calculate MFCC (simplified version)
    const mfcc = this.calculateMFCC(frequencyData);
    
    return {
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate: zcr,
      mfcc,
      tempo,
      beatTimes,
      harmonicComplexity
    };
  }

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

  private computeFFT(data: Float32Array): Float32Array {
    const N = data.length;
    const spectrum = new Float32Array(N / 2);
    
    // Optimized DFT computation using lookup tables for better performance
    const cosTable = new Float32Array(N);
    const sinTable = new Float32Array(N);
    
    // Pre-compute trigonometric values
    for (let i = 0; i < N; i++) {
      cosTable[i] = Math.cos(2 * Math.PI * i / N);
      sinTable[i] = Math.sin(2 * Math.PI * i / N);
    }
    
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const index = (k * n) % N;
        real += data[n] * cosTable[index];
        imag -= data[n] * sinTable[index];
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  private calculateZeroCrossingRate(data: Float32Array, sampleRate: number): Float32Array {
    const windowSize = Math.floor(sampleRate * 0.025); // 25ms windows
    const hopSize = Math.floor(windowSize / 2); // 50% overlap
    const numFrames = Math.floor((data.length - windowSize) / hopSize) + 1;
    const zcr = new Float32Array(numFrames);
    
    for (let i = 0; i < numFrames; i++) {
      const start = i * hopSize;
      const end = Math.min(start + windowSize, data.length - 1);
      let crossings = 0;
      
      let prevSample = data[start];
      for (let j = start + 1; j < end; j++) {
        const currentSample = data[j] - 0.97 * prevSample;
        const prevProcessed = data[j - 1] - 0.97 * data[Math.max(0, j - 2)];
        
        if ((prevProcessed >= 0) !== (currentSample >= 0)) {
          crossings++;
        }
        prevSample = data[j];
      }
      
      zcr[i] = (crossings / (end - start)) * sampleRate;
    }
    
    return zcr;
  }

  private calculateSpectralCentroid(frequencyData: FrequencyData): Float32Array {
    const centroids = new Float32Array(frequencyData.frequencies.length);
    
    for (let i = 0; i < frequencyData.frequencies.length; i++) {
      const spectrum = frequencyData.frequencies[i];
      let weightedSum = 0;
      let magnitudeSum = 0;
      
      for (let j = 1; j < spectrum.length; j++) {
        const frequency = j * frequencyData.sampleRate / (2 * spectrum.length);
        const magnitude = spectrum[j];
        weightedSum += frequency * magnitude;
        magnitudeSum += magnitude;
      }
      
      centroids[i] = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    return centroids;
  }

  private calculateSpectralRolloff(frequencyData: FrequencyData, threshold: number = 0.85): Float32Array {
    const rolloffs = new Float32Array(frequencyData.frequencies.length);
    
    for (let i = 0; i < frequencyData.frequencies.length; i++) {
      const spectrum = frequencyData.frequencies[i];
      
      let totalEnergy = 0;
      for (let j = 1; j < spectrum.length; j++) {
        totalEnergy += spectrum[j] * spectrum[j];
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
      
      rolloffs[i] = rolloffBin * frequencyData.sampleRate / (2 * spectrum.length);
    }
    
    return rolloffs;
  }

  private async estimateTempo(channelData: Float32Array, sampleRate: number): Promise<number> {
    const amplitudeData = this.extractAmplitudeEnvelope(channelData, sampleRate);
    const envelope = amplitudeData.envelope;
    
    if (envelope.length < 100) return 0;
    
    const onsets = await this.detectOnsets(channelData, sampleRate);
    
    if (onsets.length < 4) {
      return this.simpleTempoDetection(envelope, amplitudeData.timeStamps);
    }
    
    return this.autocorrelationTempo(onsets);
  }

  private trackBeats(channelData: Float32Array, sampleRate: number, tempo: number): number[] {
    if (tempo <= 0) return [];
    
    const beatInterval = 60 / tempo;
    const amplitudeData = this.extractAmplitudeEnvelope(channelData, sampleRate);
    const onsets = this.detectOnsetsFromEnvelope(amplitudeData);
    
    if (onsets.length < 2) return [];
    
    const beats: number[] = [];
    const startTime = onsets[0];
    const endTime = onsets[onsets.length - 1];
    
    for (let time = startTime; time <= endTime; time += beatInterval) {
      let closestOnset = onsets[0];
      let minDistance = Math.abs(onsets[0] - time);
      
      for (const onset of onsets) {
        const distance = Math.abs(onset - time);
        if (distance < minDistance && distance < beatInterval * 0.3) {
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

  private analyzeHarmonicContent(frequencyData: FrequencyData): Float32Array {
    const harmonicComplexity = new Float32Array(frequencyData.frequencies.length);
    
    for (let i = 0; i < frequencyData.frequencies.length; i++) {
      const spectrum = frequencyData.frequencies[i];
      
      let maxMagnitude = 0;
      let fundamentalBin = 0;
      
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
      
      const fundamentalFreq = fundamentalBin * frequencyData.sampleRate / (2 * spectrum.length);
      let harmonicEnergy = 0;
      let totalEnergy = 0;
      let harmonicCount = 0;
      
      for (let harmonic = 1; harmonic <= 10; harmonic++) {
        const harmonicFreq = fundamentalFreq * harmonic;
        const harmonicBin = Math.round(harmonicFreq * spectrum.length * 2 / frequencyData.sampleRate);
        
        if (harmonicBin >= spectrum.length) break;
        
        const windowSize = 3;
        let harmonicMagnitude = 0;
        
        for (let k = Math.max(0, harmonicBin - windowSize); 
             k <= Math.min(spectrum.length - 1, harmonicBin + windowSize); k++) {
          harmonicMagnitude += spectrum[k];
        }
        
        if (harmonicMagnitude > maxMagnitude * 0.1) {
          harmonicEnergy += harmonicMagnitude;
          harmonicCount++;
        }
      }
      
      for (let j = 0; j < spectrum.length; j++) {
        totalEnergy += spectrum[j];
      }
      
      const harmonicRatio = totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
      harmonicComplexity[i] = harmonicCount * harmonicRatio;
    }
    
    return harmonicComplexity;
  }

  private calculateMFCC(frequencyData: FrequencyData): Float32Array[] {
    // Simplified MFCC calculation
    const numCoefficients = 13;
    const mfcc: Float32Array[] = [];
    
    for (let i = 0; i < frequencyData.frequencies.length; i++) {
      const spectrum = frequencyData.frequencies[i];
      const coefficients = new Float32Array(numCoefficients);
      
      // Apply mel filter bank (simplified)
      const melFiltered = this.applyMelFilterBank(spectrum, frequencyData.sampleRate);
      
      // Apply DCT (simplified)
      for (let j = 0; j < numCoefficients; j++) {
        let sum = 0;
        for (let k = 0; k < melFiltered.length; k++) {
          sum += melFiltered[k] * Math.cos(Math.PI * j * (k + 0.5) / melFiltered.length);
        }
        coefficients[j] = sum;
      }
      
      mfcc.push(coefficients);
    }
    
    return mfcc;
  }

  private applyMelFilterBank(spectrum: Float32Array, sampleRate: number): Float32Array {
    const numFilters = 26;
    const filtered = new Float32Array(numFilters);
    
    // Convert to mel scale
    const melMin = this.hzToMel(0);
    const melMax = this.hzToMel(sampleRate / 2);
    const melStep = (melMax - melMin) / (numFilters + 1);
    
    for (let i = 0; i < numFilters; i++) {
      const melCenter = melMin + (i + 1) * melStep;
      const hzCenter = this.melToHz(melCenter);
      const binCenter = Math.floor(hzCenter * spectrum.length * 2 / sampleRate);
      
      // Simple triangular filter
      const windowSize = Math.max(1, Math.floor(spectrum.length / numFilters));
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, binCenter - windowSize); 
           j < Math.min(spectrum.length, binCenter + windowSize); j++) {
        sum += spectrum[j];
        count++;
      }
      
      filtered[i] = count > 0 ? sum / count : 0;
    }
    
    return filtered;
  }

  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  private async detectOnsets(channelData: Float32Array, sampleRate: number): Promise<number[]> {
    const frequencyData = await this.analyzeFrequencySpectrum(channelData, sampleRate);
    const onsets: number[] = [];
    
    if (frequencyData.frequencies.length < 2) return onsets;
    
    const flux: number[] = [];
    for (let i = 1; i < frequencyData.frequencies.length; i++) {
      const current = frequencyData.frequencies[i];
      const previous = frequencyData.frequencies[i - 1];
      
      let spectralFlux = 0;
      for (let j = 0; j < Math.min(current.length, previous.length); j++) {
        const diff = current[j] - previous[j];
        spectralFlux += Math.max(0, diff);
      }
      flux.push(spectralFlux);
    }
    
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

  private detectOnsetsFromEnvelope(amplitudeData: AmplitudeData): number[] {
    const onsets: number[] = [];
    const envelope = amplitudeData.envelope;
    const timeStamps = amplitudeData.timeStamps;
    
    if (envelope.length < 3) return onsets;
    
    // Find peaks in amplitude envelope
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
        onsets.push(timeStamps[i]);
      }
    }
    
    return onsets;
  }

  private calculateAdaptiveThreshold(flux: number[]): number {
    const mean = flux.reduce((sum, val) => sum + val, 0) / flux.length;
    const variance = flux.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / flux.length;
    const stdDev = Math.sqrt(variance);
    
    return mean + 2 * stdDev;
  }

  private simpleTempoDetection(envelope: Float32Array, timeStamps: number[]): number {
    const peaks: number[] = [];
    
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

  private autocorrelationTempo(onsets: number[]): number {
    if (onsets.length < 4) return 0;
    
    const duration = onsets[onsets.length - 1] - onsets[0];
    const sampleRate = 100;
    const signal = new Float32Array(Math.floor(duration * sampleRate));
    
    for (const onset of onsets) {
      const index = Math.floor((onset - onsets[0]) * sampleRate);
      if (index >= 0 && index < signal.length) {
        signal[index] = 1;
      }
    }
    
    const maxLag = Math.min(signal.length / 2, sampleRate * 2);
    const autocorr = new Float32Array(maxLag);
    
    for (let lag = 1; lag < maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < signal.length - lag; i++) {
        sum += signal[i] * signal[i + lag];
      }
      autocorr[lag] = sum;
    }
    
    let maxCorr = 0;
    let bestLag = 0;
    const minLag = Math.floor(60 * sampleRate / 200);
    const maxLagSearch = Math.floor(60 * sampleRate / 60);
    
    for (let lag = minLag; lag < Math.min(maxLagSearch, autocorr.length); lag++) {
      if (autocorr[lag] > maxCorr) {
        maxCorr = autocorr[lag];
        bestLag = lag;
      }
    }
    
    return bestLag > 0 ? 60 * sampleRate / bestLag : 0;
  }

  private postMessage(message: AudioWorkerResponse): void {
    self.postMessage(message);
  }

  private postError(error: string): void {
    this.postMessage({
      type: 'ERROR',
      data: { error }
    });
  }
}

// Initialize the worker processor
new AudioWorkerProcessor();