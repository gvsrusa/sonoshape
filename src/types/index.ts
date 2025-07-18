// Core type definitions for Sound Wave Sculptor

export interface AudioFeatures {
  frequencyData: Float32Array[];     // FFT results over time
  amplitudeEnvelope: Float32Array;   // Volume changes over time
  spectralCentroid: Float32Array;    // Brightness measure
  spectralRolloff: Float32Array;     // High-frequency content
  zeroCrossingRate: Float32Array;    // Noisiness measure
  mfcc: Float32Array[];              // Timbral characteristics
  tempo: number;                     // Beats per minute
  key: string;                       // Musical key if detectable
}

export interface SculptureParams {
  frequencyMapping: {
    lowFreqToHeight: number;         // 0-1 influence factor
    midFreqToWidth: number;
    highFreqToDepth: number;
  };
  amplitudeMapping: {
    sensitivity: number;             // 0-1 amplitude response
    smoothing: number;               // Temporal smoothing factor
  };
  stylePreset: 'organic' | 'geometric' | 'abstract' | 'architectural';
  resolution: number;                // Mesh detail level
  symmetry: 'none' | 'radial' | 'bilateral';
}

export interface BoundingBox {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface Mesh3D {
  vertices: Float32Array;            // XYZ coordinates
  faces: Uint32Array;               // Triangle indices
  normals: Float32Array;            // Surface normals
  uvs: Float32Array;                // Texture coordinates
  boundingBox: BoundingBox;
  volume: number;
  surfaceArea: number;
  isManifold: boolean;
}

export interface FrequencyData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  phases: Float32Array;
  timestamp: number;
}

export interface AmplitudeData {
  envelope: Float32Array;
  peaks: number[];
  rms: Float32Array;
}

export interface TemporalData {
  tempo: number;
  beats: number[];
  onsets: number[];
  rhythm: Float32Array;
}

export interface ProcessedFrame {
  frequencyData: FrequencyData;
  amplitudeData: AmplitudeData;
  timestamp: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface GeometryData {
  points: Point3D[];
  connections: number[][];
  normals: Point3D[];
}

export interface FrequencyMapping {
  lowFreq: { min: number; max: number };
  midFreq: { min: number; max: number };
  highFreq: { min: number; max: number };
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export interface SculptureMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  audioFileName: string;
  thumbnailUrl?: string;
  parameters: SculptureParams;
}

export interface Sculpture {
  metadata: SculptureMetadata;
  mesh: Mesh3D;
  audioFeatures: AudioFeatures;
}

export interface InteractionEvent {
  type: 'rotate' | 'zoom' | 'pan';
  deltaX: number;
  deltaY: number;
  deltaZ?: number;
}

export interface Camera {
  position: Point3D;
  target: Point3D;
  up: Point3D;
  fov: number;
  aspect: number;
  near: number;
  far: number;
}