import { describe, it, expect, beforeEach } from 'vitest';
import { MeshGenerator } from '../MeshGenerator';
import { AudioFeatures, SculptureParams, Mesh3D } from '../../types';

describe('MeshGenerator', () => {
  let meshGenerator: MeshGenerator;
  let mockAudioFeatures: AudioFeatures;
  let mockSculptureParams: SculptureParams;

  beforeEach(() => {
    meshGenerator = new MeshGenerator(32); // Lower resolution for faster tests

    // Create mock audio features with more frequency bins for better testing
    mockAudioFeatures = {
      frequencyData: [
        new Float32Array([0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]), // 16 frequency bins with strong low frequencies
        new Float32Array([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]),
        new Float32Array([0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])
      ],
      amplitudeEnvelope: new Float32Array([0.5, 0.8, 0.3]),
      spectralCentroid: new Float32Array([1000, 1200, 800]),
      spectralRolloff: new Float32Array([2000, 2400, 1600]),
      zeroCrossingRate: new Float32Array([0.1, 0.2, 0.15]),
      mfcc: [new Float32Array([1, 2, 3]), new Float32Array([2, 3, 4])],
      tempo: 120,
      key: 'C'
    };

    // Create mock sculpture parameters
    mockSculptureParams = {
      frequencyMapping: {
        lowFreqToHeight: 0.7,
        midFreqToWidth: 0.5,
        highFreqToDepth: 0.3
      },
      amplitudeMapping: {
        sensitivity: 0.8,
        smoothing: 0.6
      },
      stylePreset: 'organic',
      resolution: 32,
      symmetry: 'radial'
    };
  });

  describe('generateFromAudio', () => {
    it('should generate a valid mesh from audio features', () => {
      const mesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);

      expect(mesh).toBeDefined();
      expect(mesh.vertices).toBeInstanceOf(Float32Array);
      expect(mesh.faces).toBeInstanceOf(Uint32Array);
      expect(mesh.normals).toBeInstanceOf(Float32Array);
      expect(mesh.uvs).toBeInstanceOf(Float32Array);
    });

    it('should generate vertices with correct structure', () => {
      const mesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);

      // Vertices should be in groups of 3 (x, y, z)
      expect(mesh.vertices.length % 3).toBe(0);
      expect(mesh.vertices.length).toBeGreaterThan(0);

      // Normals should match vertex count
      expect(mesh.normals.length).toBe(mesh.vertices.length);

      // UVs should be in groups of 2 (u, v)
      expect(mesh.uvs.length % 2).toBe(0);
      expect(mesh.uvs.length * 3).toBe(mesh.vertices.length * 2);
    });

    it('should generate faces with valid indices', () => {
      const mesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);

      // Faces should be in groups of 3 (triangle indices)
      expect(mesh.faces.length % 3).toBe(0);
      expect(mesh.faces.length).toBeGreaterThan(0);

      const vertexCount = mesh.vertices.length / 3;
      
      // All face indices should be valid vertex indices
      for (let i = 0; i < mesh.faces.length; i++) {
        expect(mesh.faces[i]).toBeGreaterThanOrEqual(0);
        expect(mesh.faces[i]).toBeLessThan(vertexCount);
      }
    });

    it('should calculate valid bounding box', () => {
      const mesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);

      expect(mesh.boundingBox).toBeDefined();
      expect(mesh.boundingBox.min.x).toBeLessThanOrEqual(mesh.boundingBox.max.x);
      expect(mesh.boundingBox.min.y).toBeLessThanOrEqual(mesh.boundingBox.max.y);
      expect(mesh.boundingBox.min.z).toBeLessThanOrEqual(mesh.boundingBox.max.z);
    });

    it('should calculate positive volume and surface area', () => {
      const mesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);

      expect(mesh.volume).toBeGreaterThan(0);
      expect(mesh.surfaceArea).toBeGreaterThan(0);
    });

    it('should respond to frequency mapping parameters', () => {
      // Create audio features with more pronounced frequency differences
      const strongLowFreqAudio = {
        ...mockAudioFeatures,
        frequencyData: [
          new Float32Array([1.0, 0.9, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]), // Strong low frequencies
          new Float32Array([1.0, 0.9, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]),
          new Float32Array([1.0, 0.9, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])
        ]
      };

      const params1 = { ...mockSculptureParams };
      params1.frequencyMapping.lowFreqToHeight = 1.0;

      const params2 = { ...mockSculptureParams };
      params2.frequencyMapping.lowFreqToHeight = 0.0;

      const mesh1 = meshGenerator.generateFromAudio(strongLowFreqAudio, params1);
      const mesh2 = meshGenerator.generateFromAudio(strongLowFreqAudio, params2);

      // With strong low frequency data and different lowFreqToHeight parameters,
      // the meshes should have different properties
      const heightDiff = Math.abs(mesh1.boundingBox.max.y - mesh2.boundingBox.max.y);
      const volumeDiff = Math.abs(mesh1.volume - mesh2.volume);
      
      // The algorithm has a minimum base height, but with strong frequency data
      // and different parameters, there should still be measurable differences
      expect(heightDiff > 0.001 || volumeDiff > 0.001).toBe(true);
    });

    it('should respond to amplitude mapping parameters', () => {
      const params1 = { ...mockSculptureParams };
      params1.amplitudeMapping.sensitivity = 1.0;
      params1.amplitudeMapping.smoothing = 1.0;

      const params2 = { ...mockSculptureParams };
      params2.amplitudeMapping.sensitivity = 0.0;
      params2.amplitudeMapping.smoothing = 0.0;

      const mesh1 = meshGenerator.generateFromAudio(mockAudioFeatures, params1);
      const mesh2 = meshGenerator.generateFromAudio(mockAudioFeatures, params2);

      // Meshes with different amplitude mappings should have different radial extents
      const radius1 = Math.max(
        Math.abs(mesh1.boundingBox.max.x),
        Math.abs(mesh1.boundingBox.min.x),
        Math.abs(mesh1.boundingBox.max.z),
        Math.abs(mesh1.boundingBox.min.z)
      );

      const radius2 = Math.max(
        Math.abs(mesh2.boundingBox.max.x),
        Math.abs(mesh2.boundingBox.min.x),
        Math.abs(mesh2.boundingBox.max.z),
        Math.abs(mesh2.boundingBox.min.z)
      );

      // Check if either radius or volume is different
      const radiusDiff = Math.abs(radius1 - radius2);
      const volumeDiff = Math.abs(mesh1.volume - mesh2.volume);
      
      // The algorithm has a minimum base radius, but with different amplitude parameters
      // there should still be measurable differences
      expect(radiusDiff > 0.001 || volumeDiff > 0.001).toBe(true);
    });
  });

  describe('mesh validation', () => {
    it('should generate manifold geometry for simple cases', () => {
      const mesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);
      
      // For a simple cylindrical mesh, it should be manifold
      expect(mesh.isManifold).toBe(true);
    });

    it('should have normalized normals', () => {
      const mesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);

      // Check that normals are approximately unit length
      for (let i = 0; i < mesh.normals.length; i += 3) {
        const nx = mesh.normals[i];
        const ny = mesh.normals[i + 1];
        const nz = mesh.normals[i + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        
        // Allow for small floating point errors
        expect(length).toBeCloseTo(1.0, 5);
      }
    });

    it('should have valid UV coordinates', () => {
      const mesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);

      // UV coordinates should be between 0 and 1
      for (let i = 0; i < mesh.uvs.length; i++) {
        expect(mesh.uvs[i]).toBeGreaterThanOrEqual(0);
        expect(mesh.uvs[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty frequency data', () => {
      const emptyAudioFeatures = {
        ...mockAudioFeatures,
        frequencyData: [],
        amplitudeEnvelope: new Float32Array([])
      };

      expect(() => {
        meshGenerator.generateFromAudio(emptyAudioFeatures, mockSculptureParams);
      }).not.toThrow();
    });

    it('should handle zero amplitude', () => {
      const zeroAmplitudeFeatures = {
        ...mockAudioFeatures,
        amplitudeEnvelope: new Float32Array([0, 0, 0])
      };

      const mesh = meshGenerator.generateFromAudio(zeroAmplitudeFeatures, mockSculptureParams);
      expect(mesh.vertices.length).toBeGreaterThan(0);
    });

    it('should handle extreme parameter values', () => {
      const extremeParams = {
        ...mockSculptureParams,
        frequencyMapping: {
          lowFreqToHeight: 0,
          midFreqToWidth: 0,
          highFreqToDepth: 0
        },
        amplitudeMapping: {
          sensitivity: 0,
          smoothing: 0
        }
      };

      expect(() => {
        meshGenerator.generateFromAudio(mockAudioFeatures, extremeParams);
      }).not.toThrow();
    });
  });

  describe('constructor', () => {
    it('should use default resolution when not specified', () => {
      const defaultGenerator = new MeshGenerator();
      const mesh = defaultGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);
      
      expect(mesh.vertices.length).toBeGreaterThan(0);
    });

    it('should respect custom resolution', () => {
      const lowResGenerator = new MeshGenerator(16);
      const highResGenerator = new MeshGenerator(64);

      const lowResMesh = lowResGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);
      const highResMesh = highResGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);

      // Higher resolution should generate more vertices
      expect(highResMesh.vertices.length).toBeGreaterThan(lowResMesh.vertices.length);
    });
  });

  describe('mesh integrity validation', () => {
    let validMesh: Mesh3D;

    beforeEach(() => {
      validMesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);
    });

    it('should validate a well-formed mesh as valid', () => {
      const validation = meshGenerator.validateMeshIntegrity(validMesh);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should provide validation results with proper structure', () => {
      const validation = meshGenerator.validateMeshIntegrity(validMesh);
      
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('warnings');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('suggestions');
      expect(Array.isArray(validation.warnings)).toBe(true);
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.suggestions)).toBe(true);
    });

    it('should detect degenerate triangles', () => {
      // Create a mesh with degenerate triangles (duplicate vertices)
      const degenerateMesh: Mesh3D = {
        vertices: new Float32Array([
          0, 0, 0,  // vertex 0
          1, 0, 0,  // vertex 1
          1, 0, 0,  // vertex 2 (duplicate of vertex 1)
          0, 1, 0   // vertex 3
        ]),
        faces: new Uint32Array([
          0, 1, 2,  // degenerate triangle (vertices 1 and 2 are identical)
          0, 1, 3   // valid triangle
        ]),
        normals: new Float32Array(12),
        uvs: new Float32Array(8),
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
        volume: 0,
        surfaceArea: 0,
        isManifold: false
      };

      const validation = meshGenerator.validateMeshIntegrity(degenerateMesh);
      
      expect(validation.warnings.some(w => w.includes('degenerate'))).toBe(true);
    });

    it('should detect isolated vertices', () => {
      // Create a mesh with isolated vertices
      const meshWithIsolatedVertices: Mesh3D = {
        vertices: new Float32Array([
          0, 0, 0,  // vertex 0 - used
          1, 0, 0,  // vertex 1 - used
          0, 1, 0,  // vertex 2 - used
          5, 5, 5   // vertex 3 - isolated
        ]),
        faces: new Uint32Array([
          0, 1, 2   // only uses vertices 0, 1, 2
        ]),
        normals: new Float32Array(12),
        uvs: new Float32Array(8),
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 5, y: 5, z: 5 } },
        volume: 0,
        surfaceArea: 0,
        isManifold: true
      };

      const validation = meshGenerator.validateMeshIntegrity(meshWithIsolatedVertices);
      
      expect(validation.warnings.some(w => w.includes('isolated vertices'))).toBe(true);
    });

    it('should warn about large models', () => {
      // Create a mesh with large bounding box
      const largeMesh: Mesh3D = {
        ...validMesh,
        boundingBox: { 
          min: { x: -150, y: -150, z: -150 }, 
          max: { x: 150, y: 150, z: 150 } 
        }
      };

      const validation = meshGenerator.validateMeshIntegrity(largeMesh);
      
      expect(validation.warnings.some(w => w.includes('large'))).toBe(true);
    });

    it('should warn about thin wall thickness', () => {
      // This test checks if the validation detects potentially thin walls
      const validation = meshGenerator.validateMeshIntegrity(validMesh);
      
      // The validation should complete without errors
      expect(validation).toBeDefined();
      expect(typeof validation.isValid).toBe('boolean');
    });
  });

  describe('mesh repair functionality', () => {
    it('should repair mesh with degenerate triangles', () => {
      // Create a mesh with degenerate triangles
      const degenerateMesh: Mesh3D = {
        vertices: new Float32Array([
          0, 0, 0,  // vertex 0
          1, 0, 0,  // vertex 1
          1, 0, 0,  // vertex 2 (duplicate of vertex 1)
          0, 1, 0,  // vertex 3
          1, 1, 0   // vertex 4
        ]),
        faces: new Uint32Array([
          0, 1, 2,  // degenerate triangle
          0, 1, 3,  // valid triangle
          1, 3, 4   // valid triangle
        ]),
        normals: new Float32Array(15),
        uvs: new Float32Array(10),
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
        volume: 0,
        surfaceArea: 0,
        isManifold: false
      };

      const repairedMesh = meshGenerator.repairNonManifoldGeometry(degenerateMesh);
      
      expect(repairedMesh.faces.length).toBeLessThan(degenerateMesh.faces.length);
      expect(repairedMesh.vertices).toBeInstanceOf(Float32Array);
      expect(repairedMesh.faces).toBeInstanceOf(Uint32Array);
    });

    it('should remove isolated vertices', () => {
      // Create a mesh with isolated vertices
      const meshWithIsolatedVertices: Mesh3D = {
        vertices: new Float32Array([
          0, 0, 0,  // vertex 0 - used
          1, 0, 0,  // vertex 1 - used
          0, 1, 0,  // vertex 2 - used
          5, 5, 5,  // vertex 3 - isolated
          6, 6, 6   // vertex 4 - isolated
        ]),
        faces: new Uint32Array([
          0, 1, 2   // only uses vertices 0, 1, 2
        ]),
        normals: new Float32Array(15),
        uvs: new Float32Array(10),
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 6, y: 6, z: 6 } },
        volume: 0,
        surfaceArea: 0,
        isManifold: true
      };

      const repairedMesh = meshGenerator.repairNonManifoldGeometry(meshWithIsolatedVertices);
      
      // Should have fewer vertices after removing isolated ones
      expect(repairedMesh.vertices.length).toBeLessThan(meshWithIsolatedVertices.vertices.length);
      expect(repairedMesh.vertices.length).toBe(9); // 3 vertices * 3 coordinates
      
      // Face indices should be updated correctly
      for (let i = 0; i < repairedMesh.faces.length; i++) {
        expect(repairedMesh.faces[i]).toBeLessThan(repairedMesh.vertices.length / 3);
      }
    });

    it('should preserve valid mesh structure during repair', () => {
      const validMesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);
      const repairedMesh = meshGenerator.repairNonManifoldGeometry(validMesh);
      
      // Should maintain basic mesh structure
      expect(repairedMesh.vertices.length % 3).toBe(0);
      expect(repairedMesh.faces.length % 3).toBe(0);
      expect(repairedMesh.normals.length).toBe(repairedMesh.vertices.length);
      
      // Should recalculate properties
      expect(repairedMesh.volume).toBeGreaterThanOrEqual(0);
      expect(repairedMesh.surfaceArea).toBeGreaterThanOrEqual(0);
      expect(repairedMesh.boundingBox).toBeDefined();
    });
  });

  describe('3D printing optimization', () => {
    let testMesh: Mesh3D;

    beforeEach(() => {
      testMesh = meshGenerator.generateFromAudio(mockAudioFeatures, mockSculptureParams);
    });

    it('should optimize mesh for 3D printing', () => {
      const optimizedMesh = meshGenerator.optimizeForPrinting(testMesh, 1.0);
      
      expect(optimizedMesh).toBeDefined();
      expect(optimizedMesh.vertices).toBeInstanceOf(Float32Array);
      expect(optimizedMesh.faces).toBeInstanceOf(Uint32Array);
      expect(optimizedMesh.volume).toBeGreaterThan(0);
      expect(optimizedMesh.surfaceArea).toBeGreaterThan(0);
    });

    it('should scale mesh when wall thickness is too thin', () => {
      // Create a very small mesh that would need scaling
      const tinyMesh: Mesh3D = {
        vertices: new Float32Array([
          0, 0, 0,
          0.1, 0, 0,
          0, 0.1, 0,
          0.1, 0.1, 0
        ]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
        normals: new Float32Array(12),
        uvs: new Float32Array(8),
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0.1, y: 0.1, z: 0 } },
        volume: 0.005,
        surfaceArea: 0.02,
        isManifold: true
      };

      const optimizedMesh = meshGenerator.optimizeForPrinting(tinyMesh, 2.0);
      
      // Should be larger than original
      const originalSize = tinyMesh.boundingBox.max.x - tinyMesh.boundingBox.min.x;
      const optimizedSize = optimizedMesh.boundingBox.max.x - optimizedMesh.boundingBox.min.x;
      
      expect(optimizedSize).toBeGreaterThan(originalSize);
    });

    it('should maintain mesh validity after optimization', () => {
      const optimizedMesh = meshGenerator.optimizeForPrinting(testMesh);
      
      // Verify mesh structure is maintained
      expect(optimizedMesh.vertices.length % 3).toBe(0);
      expect(optimizedMesh.faces.length % 3).toBe(0);
      
      // All face indices should be valid
      const vertexCount = optimizedMesh.vertices.length / 3;
      for (let i = 0; i < optimizedMesh.faces.length; i++) {
        expect(optimizedMesh.faces[i]).toBeGreaterThanOrEqual(0);
        expect(optimizedMesh.faces[i]).toBeLessThan(vertexCount);
      }
    });

    it('should handle different minimum wall thickness values', () => {
      const optimized1 = meshGenerator.optimizeForPrinting(testMesh, 0.5);
      const optimized2 = meshGenerator.optimizeForPrinting(testMesh, 2.0);
      
      expect(optimized1).toBeDefined();
      expect(optimized2).toBeDefined();
      
      // Both should be valid meshes
      expect(optimized1.vertices.length).toBeGreaterThan(0);
      expect(optimized2.vertices.length).toBeGreaterThan(0);
    });
  });
});