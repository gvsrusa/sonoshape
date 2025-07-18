/**
 * Performance tests to ensure target benchmarks are met
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AudioProcessor } from "../../audio/AudioProcessor";
import { MeshGenerator } from "../../mesh/MeshGenerator";
import { PerformanceMonitor } from "../PerformanceMonitor";
import { AudioFeatures, SculptureParams } from "../../types";

describe("Performance Tests", () => {
  let performanceMonitor: PerformanceMonitor;
  let audioProcessor: AudioProcessor;
  let meshGenerator: MeshGenerator;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    audioProcessor = new AudioProcessor();
    meshGenerator = new MeshGenerator();
  });

  afterEach(() => {
    performanceMonitor.dispose();
  });

  describe("Audio Processing Performance", () => {
    it("should process 30-second audio clip in under 2 seconds", async () => {
      const sampleRate = 44100;
      const duration = 30;
      const length = sampleRate * duration;

      const mockAudioBuffer = createMockAudioBuffer(sampleRate, length);

      const startTime = performance.now();
      const result = audioProcessor.analyzeFrequencySpectrum(mockAudioBuffer);
      const frequencyData = result instanceof Promise ? await result : result;
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(2000);
      expect(frequencyData.frequencies.length).toBeGreaterThan(0);

      console.log(
        `Audio processing time: ${processingTime.toFixed(
          2
        )}ms for ${duration}s audio`
      );
    });

    it("should handle real-time processing with low latency", () => {
      const frameSize = 1024;
      const mockFrameData = new Float32Array(frameSize);

      for (let i = 0; i < frameSize; i++) {
        mockFrameData[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
      }

      const startTime = performance.now();
      const processedFrame = audioProcessor.processRealTime(mockFrameData);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(10);
      expect(processedFrame.frequencyData.length).toBeGreaterThan(0);

      console.log(`Real-time processing time: ${processingTime.toFixed(2)}ms`);
    });
  });

  describe("Mesh Generation Performance", () => {
    it("should generate standard resolution mesh in under 5 seconds", () => {
      const mockAudioFeatures = createMockAudioFeatures();
      const sculptureParams = createMockSculptureParams();

      const startTime = performance.now();
      const mesh = meshGenerator.generateFromAudio(
        mockAudioFeatures,
        sculptureParams
      );
      const endTime = performance.now();

      const generationTime = endTime - startTime;

      expect(generationTime).toBeLessThan(5000);
      expect(mesh.vertices.length).toBeGreaterThan(0);

      console.log(`Mesh generation time: ${generationTime.toFixed(2)}ms`);
    });
  });

  describe("Device Capability Detection", () => {
    it("should detect device capabilities correctly", () => {
      const capabilities = performanceMonitor.getDeviceCapabilities();

      expect(capabilities.cpuCores).toBeGreaterThan(0);
      expect(capabilities.memoryGB).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(capabilities.gpuTier);

      console.log("Device capabilities:", capabilities);
    });
  });
});

function createMockAudioBuffer(
  sampleRate: number,
  length: number
): AudioBuffer {
  const mockContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)();
  const buffer = mockContext.createBuffer(1, length, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    channelData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }

  return buffer;
}

function createMockAudioFeatures(): AudioFeatures {
  const length = 100;
  const fftSize = 1024;

  return {
    frequencyData: Array.from({ length }, () =>
      new Float32Array(fftSize).fill(0.5)
    ),
    amplitudeEnvelope: new Float32Array(length).fill(0.3),
    spectralCentroid: new Float32Array(length).fill(1000),
    spectralRolloff: new Float32Array(length).fill(5000),
    zeroCrossingRate: new Float32Array(length).fill(100),
    mfcc: Array.from({ length }, () => new Float32Array(13).fill(0.1)),
    tempo: 120,
    beatTimes: [0, 0.5, 1.0, 1.5, 2.0],
    harmonicComplexity: new Float32Array(length).fill(0.7),
    key: "C",
  };
}

function createMockSculptureParams(): SculptureParams {
  return {
    frequencyMapping: {
      lowFreqToHeight: 0.8,
      midFreqToWidth: 0.6,
      highFreqToDepth: 0.4,
    },
    amplitudeMapping: {
      sensitivity: 0.7,
      smoothing: 0.5,
    },
    stylePreset: "organic",
    resolution: 64,
    symmetry: "none",
  };
}
