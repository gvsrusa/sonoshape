// Mesh generation specific types
export interface MeshGeneratorConfig {
  resolution: number;
  smoothingIterations: number;
  manifoldRepair: boolean;
}

export interface SurfaceParameters {
  subdivisions: number;
  displacement: number;
  noiseScale: number;
}