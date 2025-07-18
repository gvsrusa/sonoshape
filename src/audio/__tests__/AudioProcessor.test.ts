import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AudioProcessor,
  FrequencyData,
  AmplitudeData,
} from "../AudioProcessor";

// Mock AudioContext for testing
class MockAudioContext {
  sampleRate = 44100;
  createAnalyser() {
    return {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 1024,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      disconnect: vi.fn(),
    };
  }
}

// Mock AudioBuffer for testing
class MockAudioBuffer {
  constructor(
    public sampleRate: number = 44100,
    public numberOfChannels: number = 1,
    public length: number = 44100,
    public duration: number = 1
  ) {}

  getChannelData(_channel: number): Float32Array {
    // Generate a simple sine wave for testing
    const data = new Float32Array(this.length);
    const frequency = 440; // A4 note
    for (let i = 0; i < this.length; i++) {
      data[i] = Math.sin((2 * Math.PI * frequency * i) / this.sampleRate);
    }
    return data;
  }
}

// Setup global mocks
(global as any).AudioContext = MockAudioContext;
(global as any).webkitAudioContext = MockAudioContext;

describe("AudioProcessor", () => {
  let processor: AudioProcessor;
  let mockBuffer: MockAudioBuffer;

  beforeEach(() => {
    processor = new AudioProcessor();
    mockBuffer = new MockAudioBuffer();
  });

  afterEach(() => {
    processor.dispose();
  });

  describe("analyzeFrequencySpectrum", () => {
    it("should return frequency data with correct structure", () => {
      const result: FrequencyData = processor.analyzeFrequencySpectrum(
        mockBuffer as any
      );

      expect(result).toHaveProperty("frequencies");
      expect(result).toHaveProperty("timeStamps");
      expect(result).toHaveProperty("sampleRate");
      expect(result).toHaveProperty("fftSize");

      expect(Array.isArray(result.frequencies)).toBe(true);
      expect(Array.isArray(result.timeStamps)).toBe(true);
      expect(result.sampleRate).toBe(44100);
      expect(result.fftSize).toBe(2048);
    });

    it("should generate frequency data for each time window", () => {
      const result: FrequencyData = processor.analyzeFrequencySpectrum(
        mockBuffer as any
      );

      expect(result.frequencies.length).toBeGreaterThan(0);
      expect(result.timeStamps.length).toBe(result.frequencies.length);

      // Each frequency array should have fftSize/2 elements
      result.frequencies.forEach((freq) => {
        expect(freq.length).toBe(result.fftSize / 2);
      });
    });

    it("should detect the dominant frequency in a sine wave", () => {
      const result: FrequencyData = processor.analyzeFrequencySpectrum(
        mockBuffer as any
      );

      // For a 440Hz sine wave, we should see peak around bin corresponding to 440Hz
      const expectedBin = Math.round(
        (440 * result.fftSize) / result.sampleRate
      );
      const spectrum = result.frequencies[0];

      // Find the bin with maximum energy
      let maxBin = 0;
      let maxValue = 0;
      for (let i = 0; i < spectrum.length; i++) {
        if (spectrum[i] > maxValue) {
          maxValue = spectrum[i];
          maxBin = i;
        }
      }

      // Should be close to expected frequency (within a few bins)
      expect(Math.abs(maxBin - expectedBin)).toBeLessThan(5);
    });
  });

  describe("extractAmplitudeEnvelope", () => {
    it("should return amplitude data with correct structure", () => {
      const result: AmplitudeData = processor.extractAmplitudeEnvelope(
        mockBuffer as any
      );

      expect(result).toHaveProperty("envelope");
      expect(result).toHaveProperty("timeStamps");
      expect(result).toHaveProperty("peak");
      expect(result).toHaveProperty("rms");

      expect(result.envelope).toBeInstanceOf(Float32Array);
      expect(Array.isArray(result.timeStamps)).toBe(true);
      expect(typeof result.peak).toBe("number");
      expect(typeof result.rms).toBe("number");
    });

    it("should calculate correct peak and RMS values for sine wave", () => {
      const result: AmplitudeData = processor.extractAmplitudeEnvelope(
        mockBuffer as any
      );

      // For a sine wave, peak should be close to 1.0
      expect(result.peak).toBeCloseTo(1.0, 1);

      // For a sine wave, RMS should be close to 1/sqrt(2) ≈ 0.707
      expect(result.rms).toBeCloseTo(0.707, 1);
    });

    it("should have envelope length matching time stamps", () => {
      const result: AmplitudeData = processor.extractAmplitudeEnvelope(
        mockBuffer as any
      );

      expect(result.envelope.length).toBe(result.timeStamps.length);
      expect(result.envelope.length).toBeGreaterThan(0);
    });
  });

  describe("getTemporalFeatures", () => {
    it("should return temporal features with expected properties", () => {
      const result = processor.getTemporalFeatures(mockBuffer as any);

      expect(result).toHaveProperty("frequencyData");
      expect(result).toHaveProperty("spectralCentroid");
      expect(result).toHaveProperty("spectralRolloff");
      expect(result).toHaveProperty("zeroCrossingRate");
      expect(result).toHaveProperty("tempo");
      expect(result).toHaveProperty("beatTimes");
      expect(result).toHaveProperty("harmonicComplexity");
      expect(result).toHaveProperty("key");
    });

    it("should calculate zero crossing rate for sine wave", () => {
      const result = processor.getTemporalFeatures(mockBuffer as any);

      expect(result.zeroCrossingRate).toBeInstanceOf(Float32Array);
      expect(result.zeroCrossingRate!.length).toBeGreaterThan(0);

      // For a 440Hz sine wave, ZCR should be around 880 (2 crossings per cycle)
      const avgZCR =
        Array.from(result.zeroCrossingRate!).reduce((a, b) => a + b, 0) /
        result.zeroCrossingRate!.length;
      expect(avgZCR).toBeGreaterThan(800);
      expect(avgZCR).toBeLessThan(1000);
    });

    it("should calculate spectral centroid for brightness mapping", () => {
      const result = processor.getTemporalFeatures(mockBuffer as any);

      expect(result.spectralCentroid).toBeInstanceOf(Float32Array);
      expect(result.spectralCentroid!.length).toBeGreaterThan(0);

      // All values should be positive frequencies
      Array.from(result.spectralCentroid!).forEach((centroid) => {
        expect(centroid).toBeGreaterThanOrEqual(0);
        expect(centroid).toBeLessThan(mockBuffer.sampleRate / 2); // Below Nyquist
      });

      // For a 440Hz sine wave, centroid should be around 440Hz
      const avgCentroid =
        Array.from(result.spectralCentroid!).reduce((a, b) => a + b, 0) /
        result.spectralCentroid!.length;
      expect(avgCentroid).toBeGreaterThan(300);
      expect(avgCentroid).toBeLessThan(600);
    });

    it("should calculate spectral rolloff for high-frequency content analysis", () => {
      const result = processor.getTemporalFeatures(mockBuffer as any);

      expect(result.spectralRolloff).toBeInstanceOf(Float32Array);
      expect(result.spectralRolloff!.length).toBeGreaterThan(0);

      // All values should be positive frequencies below Nyquist
      Array.from(result.spectralRolloff!).forEach((rolloff) => {
        expect(rolloff).toBeGreaterThanOrEqual(0);
        expect(rolloff).toBeLessThan(mockBuffer.sampleRate / 2);
      });

      // Rolloff should generally be higher than centroid for most signals
      const avgRolloff =
        Array.from(result.spectralRolloff!).reduce((a, b) => a + b, 0) /
        result.spectralRolloff!.length;
      const avgCentroid =
        Array.from(result.spectralCentroid!).reduce((a, b) => a + b, 0) /
        result.spectralCentroid!.length;
      expect(avgRolloff).toBeGreaterThanOrEqual(avgCentroid);
    });
  });

  describe("processRealTime", () => {
    it("should process real-time audio data", () => {
      const audioData = new Float32Array(1024);
      // Fill with sine wave
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
      }

      const result = processor.processRealTime(audioData);

      expect(result).toHaveProperty("frequencyData");
      expect(result).toHaveProperty("amplitudeData");
      expect(result).toHaveProperty("timestamp");

      expect(result.frequencyData).toBeInstanceOf(Float32Array);
      expect(result.amplitudeData).toBeInstanceOf(Float32Array);
      expect(typeof result.timestamp).toBe("number");
    });
  });

  describe("window functions", () => {
    it("should apply different window functions correctly", () => {
      const processors = [
        new AudioProcessor({
          fftSize: 2048,
          windowFunction: "hann",
          hopSize: 512,
        }),
        new AudioProcessor({
          fftSize: 2048,
          windowFunction: "hamming",
          hopSize: 512,
        }),
        new AudioProcessor({
          fftSize: 2048,
          windowFunction: "blackman",
          hopSize: 512,
        }),
      ];

      const results = processors.map((p) =>
        p.analyzeFrequencySpectrum(mockBuffer as any)
      );

      // Results should be different for different window functions
      expect(results[0].frequencies[0]).not.toEqual(results[1].frequencies[0]);
      expect(results[1].frequencies[0]).not.toEqual(results[2].frequencies[0]);

      processors.forEach((p) => p.dispose());
    });
  });

  describe("error handling", () => {
    it("should handle empty audio buffer gracefully", () => {
      const emptyBuffer = new MockAudioBuffer(44100, 1, 0, 0);

      expect(() => {
        processor.analyzeFrequencySpectrum(emptyBuffer as any);
      }).not.toThrow();
    });

    it("should handle very short audio buffer", () => {
      const shortBuffer = new MockAudioBuffer(44100, 1, 100, 0.002);

      expect(() => {
        processor.extractAmplitudeEnvelope(shortBuffer as any);
      }).not.toThrow();
    });
  });

  describe("spectral feature extraction accuracy", () => {
    it("should distinguish between bright and dark sounds using spectral centroid", () => {
      // Create bright sound (high frequencies)
      const brightBuffer = new MockAudioBuffer();
      brightBuffer.getChannelData = () => {
        const data = new Float32Array(44100);
        for (let i = 0; i < data.length; i++) {
          // Mix of high frequencies
          data[i] =
            Math.sin((2 * Math.PI * 2000 * i) / 44100) * 0.5 +
            Math.sin((2 * Math.PI * 4000 * i) / 44100) * 0.3 +
            Math.sin((2 * Math.PI * 8000 * i) / 44100) * 0.2;
        }
        return data;
      };

      // Create dark sound (low frequencies)
      const darkBuffer = new MockAudioBuffer();
      darkBuffer.getChannelData = () => {
        const data = new Float32Array(44100);
        for (let i = 0; i < data.length; i++) {
          // Mix of low frequencies
          data[i] =
            Math.sin((2 * Math.PI * 100 * i) / 44100) * 0.5 +
            Math.sin((2 * Math.PI * 200 * i) / 44100) * 0.3 +
            Math.sin((2 * Math.PI * 400 * i) / 44100) * 0.2;
        }
        return data;
      };

      const brightFeatures = processor.getTemporalFeatures(brightBuffer as any);
      const darkFeatures = processor.getTemporalFeatures(darkBuffer as any);

      const brightCentroid =
        Array.from(brightFeatures.spectralCentroid!).reduce(
          (a, b) => a + b,
          0
        ) / brightFeatures.spectralCentroid!.length;
      const darkCentroid =
        Array.from(darkFeatures.spectralCentroid!).reduce((a, b) => a + b, 0) /
        darkFeatures.spectralCentroid!.length;

      // Bright sound should have higher spectral centroid
      expect(brightCentroid).toBeGreaterThan(darkCentroid);
      expect(brightCentroid).toBeGreaterThan(1000); // Should be in high frequency range
      expect(darkCentroid).toBeLessThan(500); // Should be in low frequency range
    });

    it("should detect high-frequency content using spectral rolloff", () => {
      // Create signal with high-frequency content
      const highFreqBuffer = new MockAudioBuffer();
      highFreqBuffer.getChannelData = () => {
        const data = new Float32Array(44100);
        for (let i = 0; i < data.length; i++) {
          // Signal with energy extending to high frequencies
          data[i] =
            Math.sin((2 * Math.PI * 440 * i) / 44100) * 0.4 +
            Math.sin((2 * Math.PI * 2000 * i) / 44100) * 0.3 +
            Math.sin((2 * Math.PI * 8000 * i) / 44100) * 0.3;
        }
        return data;
      };

      // Create signal with limited high-frequency content
      const lowFreqBuffer = new MockAudioBuffer();
      lowFreqBuffer.getChannelData = () => {
        const data = new Float32Array(44100);
        for (let i = 0; i < data.length; i++) {
          // Signal with energy mostly in low frequencies
          data[i] =
            Math.sin((2 * Math.PI * 440 * i) / 44100) * 0.7 +
            Math.sin((2 * Math.PI * 880 * i) / 44100) * 0.3;
        }
        return data;
      };

      const highFreqFeatures = processor.getTemporalFeatures(
        highFreqBuffer as any
      );
      const lowFreqFeatures = processor.getTemporalFeatures(
        lowFreqBuffer as any
      );

      const highRolloff =
        Array.from(highFreqFeatures.spectralRolloff!).reduce(
          (a, b) => a + b,
          0
        ) / highFreqFeatures.spectralRolloff!.length;
      const lowRolloff =
        Array.from(lowFreqFeatures.spectralRolloff!).reduce(
          (a, b) => a + b,
          0
        ) / lowFreqFeatures.spectralRolloff!.length;

      // High-frequency signal should have higher rolloff
      expect(highRolloff).toBeGreaterThan(lowRolloff);
      expect(highRolloff).toBeGreaterThan(2000); // Should capture high-frequency content
    });

    it("should detect texture variation using zero crossing rate", () => {
      // Create noisy/textured signal
      const noisyBuffer = new MockAudioBuffer();
      noisyBuffer.getChannelData = () => {
        const data = new Float32Array(44100);
        for (let i = 0; i < data.length; i++) {
          // White noise-like signal with many zero crossings
          data[i] = (Math.random() - 0.5) * 2;
        }
        return data;
      };

      // Create tonal signal
      const tonalBuffer = new MockAudioBuffer(); // Uses default sine wave

      const noisyFeatures = processor.getTemporalFeatures(noisyBuffer as any);
      const tonalFeatures = processor.getTemporalFeatures(tonalBuffer as any);

      const noisyZCR =
        Array.from(noisyFeatures.zeroCrossingRate!).reduce((a, b) => a + b, 0) /
        noisyFeatures.zeroCrossingRate!.length;
      const tonalZCR =
        Array.from(tonalFeatures.zeroCrossingRate!).reduce((a, b) => a + b, 0) /
        tonalFeatures.zeroCrossingRate!.length;

      // Noisy signal should have much higher zero crossing rate
      expect(noisyZCR).toBeGreaterThan(tonalZCR * 2);
      expect(noisyZCR).toBeGreaterThan(5000); // High ZCR for noise
      expect(tonalZCR).toBeLessThan(2000); // Lower ZCR for tonal content
    });

    it("should handle edge cases in spectral feature extraction", () => {
      // Test with silence
      const silentBuffer = new MockAudioBuffer();
      silentBuffer.getChannelData = () => new Float32Array(44100); // All zeros

      const silentFeatures = processor.getTemporalFeatures(silentBuffer as any);

      // Should handle silence gracefully
      expect(silentFeatures.spectralCentroid).toBeInstanceOf(Float32Array);
      expect(silentFeatures.spectralRolloff).toBeInstanceOf(Float32Array);
      expect(silentFeatures.zeroCrossingRate).toBeInstanceOf(Float32Array);

      // Values should be zero or very low for silence
      const avgCentroid =
        Array.from(silentFeatures.spectralCentroid!).reduce(
          (a, b) => a + b,
          0
        ) / silentFeatures.spectralCentroid!.length;
      const avgZCR =
        Array.from(silentFeatures.zeroCrossingRate!).reduce(
          (a, b) => a + b,
          0
        ) / silentFeatures.zeroCrossingRate!.length;

      expect(avgCentroid).toBeLessThan(100);
      expect(avgZCR).toBeLessThan(100);
    });
  });

  describe("temporal pattern recognition", () => {
    it("should detect tempo for rhythmic sculpture elements", () => {
      // Create rhythmic signal with clear beat pattern at 120 BPM
      const rhythmicBuffer = new MockAudioBuffer(44100, 1, 44100 * 4, 4); // 4 seconds
      rhythmicBuffer.getChannelData = () => {
        const data = new Float32Array(44100 * 4);
        const bpm = 120;
        const beatInterval = 60 / bpm; // 0.5 seconds per beat
        const sampleRate = 44100;

        for (let i = 0; i < data.length; i++) {
          const time = i / sampleRate;
          // Create beats every 0.5 seconds with decay
          const beatPhase = (time % beatInterval) / beatInterval;
          const beatEnvelope = Math.exp(-beatPhase * 10); // Exponential decay

          // Mix of frequencies for each beat
          data[i] =
            beatEnvelope *
            (Math.sin(2 * Math.PI * 60 * time) * 0.5 + // Bass drum
              Math.sin(2 * Math.PI * 200 * time) * 0.3 + // Snare
              Math.sin(2 * Math.PI * 8000 * time) * 0.2); // Hi-hat
        }
        return data;
      };

      const features = processor.getTemporalFeatures(rhythmicBuffer as any);

      expect(typeof features.tempo).toBe("number");
      expect(features.tempo).toBeGreaterThan(0);

      // Should detect tempo close to 120 BPM (allow some tolerance)
      expect(features.tempo).toBeGreaterThan(100);
      expect(features.tempo).toBeLessThan(140);
    });

    it("should track beats for temporal mesh progression", () => {
      // Create signal with clear beat pattern
      const beatBuffer = new MockAudioBuffer(44100, 1, 44100 * 2, 2); // 2 seconds
      beatBuffer.getChannelData = () => {
        const data = new Float32Array(44100 * 2);
        const sampleRate = 44100;

        // Create beats at 0, 0.5, 1.0, 1.5 seconds (120 BPM)
        const beatTimes = [0, 0.5, 1.0, 1.5];

        for (let i = 0; i < data.length; i++) {
          const time = i / sampleRate;
          let amplitude = 0;

          // Create impulse-like beats
          for (const beatTime of beatTimes) {
            if (Math.abs(time - beatTime) < 0.05) {
              // 50ms beat duration
              const beatPhase = (time - beatTime) / 0.05;
              amplitude +=
                Math.exp(-beatPhase * 20) * Math.sin(2 * Math.PI * 100 * time);
            }
          }

          data[i] = amplitude;
        }
        return data;
      };

      const features = processor.getTemporalFeatures(beatBuffer as any);

      expect(Array.isArray(features.beatTimes)).toBe(true);
      expect(features.beatTimes!.length).toBeGreaterThan(0);

      // Should detect beats close to expected times
      const expectedBeats = [0, 0.5, 1.0, 1.5];
      expect(features.beatTimes!.length).toBeGreaterThanOrEqual(2);

      // Check that detected beats are reasonably close to expected beats
      for (const detectedBeat of features.beatTimes!) {
        const closestExpected = expectedBeats.reduce((prev, curr) =>
          Math.abs(curr - detectedBeat) < Math.abs(prev - detectedBeat)
            ? curr
            : prev
        );
        expect(Math.abs(detectedBeat - closestExpected)).toBeLessThan(0.2); // Within 200ms
      }
    });

    it("should analyze harmonic content for surface texture complexity", () => {
      // Create harmonic-rich signal (sawtooth-like with many harmonics)
      const harmonicBuffer = new MockAudioBuffer();
      harmonicBuffer.getChannelData = () => {
        const data = new Float32Array(44100);
        const fundamental = 220; // A3

        for (let i = 0; i < data.length; i++) {
          const time = i / 44100;
          let sample = 0;

          // Add first 8 harmonics with decreasing amplitude
          for (let harmonic = 1; harmonic <= 8; harmonic++) {
            sample +=
              Math.sin(2 * Math.PI * fundamental * harmonic * time) / harmonic;
          }

          data[i] = sample * 0.3; // Scale down
        }
        return data;
      };

      // Create simple sine wave (low harmonic content)
      const simpleBuffer = new MockAudioBuffer(); // Default sine wave

      const harmonicFeatures = processor.getTemporalFeatures(
        harmonicBuffer as any
      );
      const simpleFeatures = processor.getTemporalFeatures(simpleBuffer as any);

      expect(harmonicFeatures.harmonicComplexity).toBeInstanceOf(Float32Array);
      expect(simpleFeatures.harmonicComplexity).toBeInstanceOf(Float32Array);

      const avgHarmonicComplexity =
        Array.from(harmonicFeatures.harmonicComplexity!).reduce(
          (a, b) => a + b,
          0
        ) / harmonicFeatures.harmonicComplexity!.length;
      const avgSimpleComplexity =
        Array.from(simpleFeatures.harmonicComplexity!).reduce(
          (a, b) => a + b,
          0
        ) / simpleFeatures.harmonicComplexity!.length;

      // Harmonic-rich signal should have higher complexity
      expect(avgHarmonicComplexity).toBeGreaterThan(avgSimpleComplexity);
      expect(avgHarmonicComplexity).toBeGreaterThan(1); // Should detect multiple harmonics
    });

    it("should handle temporal pattern recognition edge cases", () => {
      // Test with very short buffer
      const shortBuffer = new MockAudioBuffer(44100, 1, 1000, 0.023); // 23ms

      const shortFeatures = processor.getTemporalFeatures(shortBuffer as any);

      // Should handle short buffers gracefully
      expect(typeof shortFeatures.tempo).toBe("number");
      expect(Array.isArray(shortFeatures.beatTimes)).toBe(true);
      expect(shortFeatures.harmonicComplexity).toBeInstanceOf(Float32Array);

      // Tempo should be 0 or very low for short buffers
      expect(shortFeatures.tempo).toBeLessThan(10);
    });

    it("should provide consistent temporal feature measurements", () => {
      // Test consistency across multiple calls
      const testBuffer = new MockAudioBuffer();

      const features1 = processor.getTemporalFeatures(testBuffer as any);
      const features2 = processor.getTemporalFeatures(testBuffer as any);

      // Results should be consistent
      expect(features1.tempo).toBe(features2.tempo);
      expect(features1.beatTimes!.length).toBe(features2.beatTimes!.length);

      // Harmonic complexity arrays should be equal
      expect(features1.harmonicComplexity!.length).toBe(
        features2.harmonicComplexity!.length
      );
      for (let i = 0; i < features1.harmonicComplexity!.length; i++) {
        expect(features1.harmonicComplexity![i]).toBeCloseTo(
          features2.harmonicComplexity![i],
          5
        );
      }
    });

    it("should detect different rhythmic patterns", () => {
      // Create fast rhythm (180 BPM)
      const fastBuffer = new MockAudioBuffer(44100, 1, 44100 * 2, 2);
      fastBuffer.getChannelData = () => {
        const data = new Float32Array(44100 * 2);
        const bpm = 180;
        const beatInterval = 60 / bpm;

        for (let i = 0; i < data.length; i++) {
          const time = i / 44100;
          const beatPhase = (time % beatInterval) / beatInterval;
          const beatEnvelope = Math.exp(-beatPhase * 15);
          data[i] = beatEnvelope * Math.sin(2 * Math.PI * 100 * time);
        }
        return data;
      };

      // Create slow rhythm (60 BPM)
      const slowBuffer = new MockAudioBuffer(44100, 1, 44100 * 4, 4);
      slowBuffer.getChannelData = () => {
        const data = new Float32Array(44100 * 4);
        const bpm = 60;
        const beatInterval = 60 / bpm;

        for (let i = 0; i < data.length; i++) {
          const time = i / 44100;
          const beatPhase = (time % beatInterval) / beatInterval;
          const beatEnvelope = Math.exp(-beatPhase * 5);
          data[i] = beatEnvelope * Math.sin(2 * Math.PI * 100 * time);
        }
        return data;
      };

      const fastFeatures = processor.getTemporalFeatures(fastBuffer as any);
      const slowFeatures = processor.getTemporalFeatures(slowBuffer as any);

      // Fast rhythm should have higher tempo
      expect(fastFeatures.tempo).toBeDefined();
      expect(slowFeatures.tempo).toBeDefined();
      expect(fastFeatures.tempo!).toBeGreaterThan(slowFeatures.tempo!);
      expect(fastFeatures.tempo!).toBeGreaterThan(150);
      expect(slowFeatures.tempo!).toBeLessThan(80);
    });
  });

  describe("performance", () => {
    it("should process audio within reasonable time limits", () => {
      const largeBuffer = new MockAudioBuffer(44100, 1, 44100 * 1, 1); // 1 second

      const startTime = performance.now();
      processor.analyzeFrequencySpectrum(largeBuffer as any);
      const endTime = performance.now();

      // Should complete within 5 seconds for 1 second of audio (simplified FFT is slow)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});
