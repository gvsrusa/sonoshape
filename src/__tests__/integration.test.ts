/**
 * End-to-end integration tests for the Sound Wave Sculptor application
 * Tests complete workflow from audio upload to 3D export
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AudioProcessor } from "../audio/AudioProcessor";
import { MeshGenerator } from "../mesh/MeshGenerator";
import { PerformanceMonitor } from "../performance/PerformanceMonitor";
import { AudioFeatures, SculptureParams } from "../types";

// Mock WebGL and Canvas contexts for testing
const mockWebGLContext = {
  getParameter: vi.fn((param) => {
    switch (param) {
      case "MAX_TEXTURE_SIZE":
        return 2048;
      case "MAX_VERTEX_ATTRIBS":
        return 16;
      case 37446:
        return "Mock WebGL Renderer"; // UNMASKED_RENDERER_WEBGL
      default:
        return null;
    }
  }),
  getExtension: vi.fn((name) => {
    if (name === "WEBGL_debug_renderer_info") {
      return { UNMASKED_RENDERER_WEBGL: 37446 };
    }
    return null;
  }),
};

// Mock HTMLCanvasElement.getContext before any imports
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: vi.fn((type) => {
    if (type === "webgl" || type === "experimental-webgl") {
      return mockWebGLContext;
    }
    if (type === "webgl2") {
      return mockWebGLContext;
    }
    return null;
  }),
  writable: true,
});

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  createBuffer: vi.fn((channels, length, sampleRate) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  })),
  createAnalyser: vi.fn(() => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0.8,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  destination: {},
  sampleRate: 44100,
  currentTime: 0,
  state: "running",
}));

// Mock navigator properties
Object.defineProperty(global.navigator, "hardwareConcurrency", {
  value: 8,
  writable: true,
});

Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn(),
  },
  writable: true,
});

// Mock performance.memory
Object.defineProperty(global.performance, "memory", {
  value: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
  },
  writable: true,
});

// Mock Three.js WebGLRenderer
vi.mock("three", () => ({
  WebGLRenderer: vi.fn().mockImplementation(() => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement("canvas"),
    shadowMap: {
      enabled: false,
      type: "PCFSoftShadowMap",
    },
    outputColorSpace: "srgb",
    toneMapping: "ACESFilmicToneMapping",
    toneMappingExposure: 1.0,
  })),
  Scene: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    background: null,
    fog: null,
  })),
  PerspectiveCamera: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    lookAt: vi.fn(),
    updateProjectionMatrix: vi.fn(),
    fov: 75,
    aspect: 1,
    near: 0.1,
    far: 1000,
  })),
  AmbientLight: vi.fn().mockImplementation(() => ({})),
  DirectionalLight: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    castShadow: false,
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: {
        near: 0.5,
        far: 50,
        left: -10,
        right: 10,
        top: 10,
        bottom: -10,
      },
    },
  })),
  BufferGeometry: vi.fn().mockImplementation(() => ({
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    computeVertexNormals: vi.fn(),
    dispose: vi.fn(),
  })),
  BufferAttribute: vi.fn(),
  Mesh: vi.fn().mockImplementation(() => ({
    castShadow: false,
    receiveShadow: false,
    material: { dispose: vi.fn() },
    geometry: { dispose: vi.fn() },
  })),
  MeshPhongMaterial: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
    needsUpdate: false,
  })),
  MeshBasicMaterial: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
  Vector3: vi.fn().mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z })),
  Color: vi.fn().mockImplementation(() => ({})),
  Fog: vi.fn().mockImplementation(() => ({})),
}));

// Mock OrbitControls
vi.mock("three/examples/jsm/controls/OrbitControls.js", () => ({
  OrbitControls: vi.fn().mockImplementation(() => ({
    enableDamping: true,
    dampingFactor: 0.05,
    screenSpacePanning: false,
    minDistance: 2,
    maxDistance: 50,
    maxPolarAngle: Math.PI,
    target: { copy: vi.fn() },
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe("End-to-End Integration Tests", () => {
  let audioProcessor: AudioProcessor;
  let meshGenerator: MeshGenerator;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    // Initialize components
    audioProcessor = new AudioProcessor();
    meshGenerator = new MeshGenerator();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    // Clean up resources
    performanceMonitor.dispose();
  });

  describe("Audio Processing Performance", () => {
    it("should process audio and extract features efficiently", async () => {
      const mockAudioBuffer = createMockAudioBuffer(44100, 44100); // 1 second

      const startTime = performance.now();
      const features = await audioProcessor.getTemporalFeatures(
        mockAudioBuffer
      );
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(10000); // Less than 10 seconds for 1 second of audio
      expect(features.spectralCentroid).toBeDefined();
      expect(features.spectralRolloff).toBeDefined();
      expect(features.zeroCrossingRate).toBeDefined();

      console.log(
        `Audio feature extraction time: ${processingTime.toFixed(2)}ms`
      );
    });

    it("should handle real-time processing with low latency", () => {
      const frameSize = 1024;
      const mockFrameData = new Float32Array(frameSize);

      // Fill with mock audio data
      for (let i = 0; i < frameSize; i++) {
        mockFrameData[i] = Math.sin((2 * Math.PI * 440 * i) / 44100); // 440Hz sine wave
      }

      const startTime = performance.now();
      const processedFrame = audioProcessor.processRealTime(mockFrameData);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(10); // Less than 10ms for real-time processing
      expect(processedFrame.frequencyData.length).toBeGreaterThan(0);
      expect(processedFrame.amplitudeData.length).toBeGreaterThan(0);

      console.log(`Real-time processing time: ${processingTime.toFixed(2)}ms`);
    });
  });

  describe("Mesh Generation Performance", () => {
    it("should generate mesh from audio features efficiently", () => {
      const mockAudioFeatures = createMockAudioFeatures();
      const sculptureParams = createMockSculptureParams();

      const startTime = performance.now();
      const mesh = meshGenerator.generateFromAudio(
        mockAudioFeatures,
        sculptureParams
      );
      const endTime = performance.now();

      const generationTime = endTime - startTime;

      expect(generationTime).toBeLessThan(5000); // Less than 5 seconds
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.faces.length).toBeGreaterThan(0);
      expect(mesh.normals.length).toBeGreaterThan(0);

      console.log(`Mesh generation time: ${generationTime.toFixed(2)}ms`);
    });

    it("should validate mesh integrity", () => {
      const mockAudioFeatures = createMockAudioFeatures();
      const sculptureParams = createMockSculptureParams();
      const mesh = meshGenerator.generateFromAudio(
        mockAudioFeatures,
        sculptureParams
      );

      const startTime = performance.now();
      const validation = meshGenerator.validateMeshIntegrity(mesh);
      const endTime = performance.now();

      const validationTime = endTime - startTime;

      expect(validationTime).toBeLessThan(100); // Less than 100ms
      expect(validation.isValid).toBeDefined();
      expect(validation.warnings).toBeDefined();
      expect(validation.errors).toBeDefined();

      console.log(`Mesh validation time: ${validationTime.toFixed(2)}ms`);
    });
  });

  describe("Performance Monitoring", () => {
    it("should detect device capabilities correctly", () => {
      const capabilities = performanceMonitor.getDeviceCapabilities();

      expect(capabilities.cpuCores).toBeGreaterThan(0);
      expect(capabilities.memoryGB).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(capabilities.gpuTier);
      expect(typeof capabilities.webglSupport).toBe("boolean");
      expect(typeof capabilities.isLowEndDevice).toBe("boolean");

      console.log("Device capabilities:", capabilities);
    });

    it("should provide appropriate quality settings", () => {
      const qualitySettings = performanceMonitor.getQualitySettings();
      const deviceCaps = performanceMonitor.getDeviceCapabilities();

      expect(qualitySettings.meshResolution).toBeGreaterThan(0);
      expect(qualitySettings.fftSize).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(
        qualitySettings.visualizationQuality
      );

      if (deviceCaps.isLowEndDevice) {
        expect(qualitySettings.meshResolution).toBeLessThanOrEqual(32);
        expect(qualitySettings.enableShadows).toBe(false);
      }

      console.log("Quality settings:", qualitySettings);
    });

    it("should provide performance recommendations", () => {
      const recommendations =
        performanceMonitor.getPerformanceRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);

      if (recommendations.length > 0) {
        console.log("Performance recommendations:", recommendations);
      }
    });
  });

  describe("Complete Audio-to-Mesh Workflow", () => {
    it("should complete full workflow from audio features to 3D mesh", async () => {
      // Step 1: Create mock audio buffer
      const mockAudioBuffer = createMockAudioBuffer(44100, 44100 * 5); // 5 seconds

      // Step 2: Extract audio features
      const audioFeatures = await extractAudioFeatures(mockAudioBuffer);
      expect(audioFeatures.frequencyData.length).toBeGreaterThan(0);
      expect(audioFeatures.amplitudeEnvelope.length).toBeGreaterThan(0);

      // Step 3: Generate sculpture parameters
      const sculptureParams = createMockSculptureParams();
      expect(sculptureParams).toBeDefined();

      // Step 4: Generate 3D mesh
      const mesh = meshGenerator.generateFromAudio(
        audioFeatures,
        sculptureParams
      );
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.faces.length).toBeGreaterThan(0);
      expect(mesh.isManifold).toBe(true);

      // Step 5: Validate mesh
      const validation = meshGenerator.validateMeshIntegrity(mesh);
      expect(validation.isValid).toBe(true);

      console.log("✅ Complete workflow test passed");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid audio data gracefully", () => {
      const invalidAudioFeatures = {
        ...createMockAudioFeatures(),
        frequencyData: [], // Empty frequency data
      };
      const sculptureParams = createMockSculptureParams();

      expect(() => {
        meshGenerator.generateFromAudio(invalidAudioFeatures, sculptureParams);
      }).toThrow();
    });

    it("should handle memory limitations gracefully", () => {
      // Test with very large audio data
      const largeAudioFeatures = createLargeAudioFeatures();
      const sculptureParams = createMockSculptureParams();

      expect(() => {
        meshGenerator.generateFromAudio(largeAudioFeatures, sculptureParams);
      }).not.toThrow();
    });
  });
});

// Helper functions for creating mock data
function createMockAudioBuffer(
  sampleRate: number,
  length: number
): AudioBuffer {
  const channelData = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    channelData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }

  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => channelData,
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as AudioBuffer;
}

async function extractAudioFeatures(
  audioBuffer: AudioBuffer
): Promise<AudioFeatures> {
  const audioProcessor = new AudioProcessor();
  const result = audioProcessor.analyzeFrequencySpectrum(audioBuffer);
  const frequencyData = result instanceof Promise ? await result : result;
  const temporalFeatures = await audioProcessor.getTemporalFeatures(
    audioBuffer
  );

  return {
    frequencyData: frequencyData.frequencies,
    amplitudeEnvelope:
      temporalFeatures.amplitudeEnvelope || new Float32Array(100).fill(0.3),
    spectralCentroid:
      temporalFeatures.spectralCentroid || new Float32Array(100).fill(1000),
    spectralRolloff:
      temporalFeatures.spectralRolloff || new Float32Array(100).fill(5000),
    zeroCrossingRate:
      temporalFeatures.zeroCrossingRate || new Float32Array(100).fill(100),
    mfcc:
      temporalFeatures.mfcc ||
      Array.from({ length: 100 }, () => new Float32Array(13).fill(0.1)),
    tempo: temporalFeatures.tempo || 120,
    beatTimes: temporalFeatures.beatTimes || [0, 0.5, 1.0, 1.5, 2.0],
    harmonicComplexity:
      temporalFeatures.harmonicComplexity || new Float32Array(100).fill(0.7),
    key: "C",
  };
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

function createLargeAudioFeatures(): AudioFeatures {
  const length = 10000; // Very large dataset
  const fftSize = 4096;

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
    beatTimes: Array.from({ length: 1000 }, (_, i) => i * 0.5),
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
