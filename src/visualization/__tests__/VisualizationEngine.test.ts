import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VisualizationEngine } from '../VisualizationEngine';
import { Mesh3D, BoundingBox, ProcessedFrame, AudioFeatures } from '../../types/index';

// Mock Three.js and OrbitControls
vi.mock('three', () => ({
  Scene: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    getObjectByName: vi.fn(),
    background: null,
    fog: null
  })),
  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement('canvas'),
    shadowMap: { enabled: false, type: null },
    outputColorSpace: null,
    toneMapping: null,
    toneMappingExposure: 1
  })),
  PerspectiveCamera: vi.fn(() => ({
    position: { set: vi.fn(), multiplyScalar: vi.fn() },
    lookAt: vi.fn(),
    updateProjectionMatrix: vi.fn(),
    aspect: 1,
    fov: 75,
    near: 0.1,
    far: 1000
  })),
  BufferGeometry: vi.fn(() => ({
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    computeVertexNormals: vi.fn(),
    setFromPoints: vi.fn().mockReturnThis(),
    dispose: vi.fn()
  })),
  BufferAttribute: vi.fn(),
  Mesh: vi.fn(() => ({
    geometry: { dispose: vi.fn() },
    material: { 
      dispose: vi.fn(),
      emissive: { setRGB: vi.fn() },
      opacity: 0.8
    },
    castShadow: false,
    receiveShadow: false,
    scale: { y: 1 },
    position: { x: 0, y: 0, z: 0 }
  })),
  Line: vi.fn(() => ({
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn() }
  })),
  BoxGeometry: vi.fn(() => ({ dispose: vi.fn() })),
  PlaneGeometry: vi.fn(() => ({ dispose: vi.fn() })),
  MeshPhongMaterial: vi.fn(() => ({
    dispose: vi.fn(),
    needsUpdate: false,
    emissive: { setRGB: vi.fn() },
    opacity: 0.8
  })),
  MeshBasicMaterial: vi.fn(() => ({
    dispose: vi.fn(),
    needsUpdate: false
  })),
  LineBasicMaterial: vi.fn(() => ({
    dispose: vi.fn()
  })),
  AmbientLight: vi.fn(() => ({})),
  DirectionalLight: vi.fn(() => ({
    position: { set: vi.fn() },
    castShadow: false,
    shadow: {
      mapSize: { width: 0, height: 0 },
      camera: { near: 0, far: 0, left: 0, right: 0, top: 0, bottom: 0 }
    }
  })),
  Color: vi.fn(() => ({
    setHSL: vi.fn().mockReturnThis(),
    setRGB: vi.fn().mockReturnThis()
  })),
  Fog: vi.fn(),
  Vector3: vi.fn(() => ({
    copy: vi.fn(),
    set: vi.fn()
  })),
  AnimationMixer: vi.fn(() => ({
    update: vi.fn(),
    clipAction: vi.fn(() => ({
      setLoop: vi.fn().mockReturnThis(),
      play: vi.fn()
    })),
    setTime: vi.fn(),
    stopAllAction: vi.fn()
  })),
  AnimationClip: vi.fn(),
  VectorKeyframeTrack: vi.fn(),
  LoopOnce: 'LoopOnce',
  AdditiveBlending: 'AdditiveBlending',
  PCFSoftShadowMap: 'PCFSoftShadowMap',
  SRGBColorSpace: 'SRGBColorSpace',
  ACESFilmicToneMapping: 'ACESFilmicToneMapping'
}));

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn(() => ({
    enableDamping: true,
    dampingFactor: 0.05,
    screenSpacePanning: false,
    minDistance: 2,
    maxDistance: 50,
    maxPolarAngle: Math.PI,
    target: { copy: vi.fn() },
    update: vi.fn(),
    dispose: vi.fn()
  }))
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

global.cancelAnimationFrame = vi.fn();

describe('VisualizationEngine', () => {
  let container: HTMLElement;
  let engine: VisualizationEngine;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
    document.body.removeChild(container);
  });

  it('should initialize with default configuration', () => {
    engine = new VisualizationEngine(container);
    
    expect(engine).toBeDefined();
    expect(engine.getRenderer()).toBeDefined();
    expect(engine.getScene()).toBeDefined();
    expect(engine.getCamera()).toBeDefined();
  });

  it('should initialize with custom configuration', () => {
    const config = {
      antialias: false,
      shadows: false,
      postProcessing: true
    };
    
    engine = new VisualizationEngine(container, config);
    
    expect(engine).toBeDefined();
  });

  it('should render a mesh successfully', () => {
    engine = new VisualizationEngine(container);
    
    const mockMesh: Mesh3D = {
      vertices: new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0
      ]),
      faces: new Uint32Array([0, 1, 2]),
      normals: new Float32Array([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
      ]),
      uvs: new Float32Array([
        0, 0,
        1, 0,
        0, 1
      ]),
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 0 }
      } as BoundingBox,
      volume: 0.5,
      surfaceArea: 1.0,
      isManifold: true
    };

    expect(() => engine.renderMesh(mockMesh)).not.toThrow();
  });

  it('should handle user interactions', () => {
    engine = new VisualizationEngine(container);
    
    const rotateEvent = {
      type: 'rotate' as const,
      deltaX: 10,
      deltaY: 5
    };
    
    const zoomEvent = {
      type: 'zoom' as const,
      deltaX: 0,
      deltaY: -100
    };
    
    expect(() => engine.handleUserInteraction(rotateEvent)).not.toThrow();
    expect(() => engine.handleUserInteraction(zoomEvent)).not.toThrow();
  });

  it('should update render settings', () => {
    engine = new VisualizationEngine(container);
    
    const newSettings = {
      wireframe: true,
      backgroundColor: '#ff0000'
    };
    
    expect(() => engine.updateRenderSettings(newSettings)).not.toThrow();
  });

  it('should handle resize correctly', () => {
    engine = new VisualizationEngine(container);
    
    expect(() => engine.resize(1024, 768)).not.toThrow();
  });

  it('should dispose resources properly', () => {
    engine = new VisualizationEngine(container);
    
    expect(() => engine.dispose()).not.toThrow();
  });

  // Real-time visualization tests
  it('should set audio features and setup visualizations', () => {
    engine = new VisualizationEngine(container);
    
    const mockAudioFeatures: AudioFeatures = {
      frequencyData: [new Float32Array([0.1, 0.2, 0.3])],
      amplitudeEnvelope: new Float32Array([0.5, 0.8, 0.3, 0.1]),
      spectralCentroid: new Float32Array([1000, 1200, 800]),
      spectralRolloff: new Float32Array([2000, 2500, 1800]),
      zeroCrossingRate: new Float32Array([0.1, 0.2, 0.15]),
      mfcc: [new Float32Array([0.1, 0.2])],
      tempo: 120,
      key: 'C'
    };
    
    expect(() => engine.setAudioFeatures(mockAudioFeatures)).not.toThrow();
  });

  it('should update real-time visualizations', () => {
    engine = new VisualizationEngine(container);
    
    const mockProcessedFrame: ProcessedFrame = {
      frequencyData: {
        frequencies: new Float32Array([100, 200, 300]),
        magnitudes: new Float32Array([0.5, 0.8, 0.3]),
        phases: new Float32Array([0, 1.57, 3.14]),
        timestamp: 1.0
      },
      amplitudeData: {
        envelope: new Float32Array([0.5, 0.8, 0.3]),
        peaks: [1, 3, 5],
        rms: new Float32Array([0.4, 0.6, 0.2])
      },
      timestamp: 1.0
    };
    
    expect(() => engine.updateRealTime(mockProcessedFrame)).not.toThrow();
  });

  it('should handle audio playback controls', () => {
    engine = new VisualizationEngine(container);
    
    expect(() => engine.playAudio()).not.toThrow();
    expect(() => engine.pauseAudio()).not.toThrow();
    expect(() => engine.seekTo(5.0)).not.toThrow();
  });

  it('should manage timeline callbacks', () => {
    engine = new VisualizationEngine(container);
    
    const mockCallback = vi.fn();
    
    expect(() => engine.addTimelineCallback(mockCallback)).not.toThrow();
    expect(() => engine.removeTimelineCallback(mockCallback)).not.toThrow();
  });

  it('should animate with audio', () => {
    engine = new VisualizationEngine(container);
    
    const mockAudioBuffer = {} as AudioBuffer;
    const mockMesh: Mesh3D = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      faces: new Uint32Array([0, 1, 2]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 0 }
      } as BoundingBox,
      volume: 0.5,
      surfaceArea: 1.0,
      isManifold: true
    };
    
    // First set audio features
    const mockAudioFeatures: AudioFeatures = {
      frequencyData: [new Float32Array([0.1, 0.2, 0.3])],
      amplitudeEnvelope: new Float32Array([0.5, 0.8, 0.3, 0.1]),
      spectralCentroid: new Float32Array([1000]),
      spectralRolloff: new Float32Array([2000]),
      zeroCrossingRate: new Float32Array([0.1]),
      mfcc: [new Float32Array([0.1])],
      tempo: 120,
      key: 'C'
    };
    
    engine.setAudioFeatures(mockAudioFeatures);
    engine.renderMesh(mockMesh);
    
    expect(() => engine.animateWithAudio(mockAudioBuffer, mockMesh)).not.toThrow();
  });
});