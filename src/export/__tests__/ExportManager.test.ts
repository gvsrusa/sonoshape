import { ExportManager } from '../ExportManager';
import { Mesh3D, ValidationResult } from '../../types';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';

describe('ExportManager', () => {
  let exportManager: ExportManager;
  let mockMesh: Mesh3D;

  beforeEach(() => {
    exportManager = new ExportManager();
    
    // Create a simple test mesh (a triangle)
    mockMesh = {
      vertices: new Float32Array([
        0, 0, 0,    // vertex 0
        1, 0, 0,    // vertex 1
        0.5, 1, 0   // vertex 2
      ]),
      faces: new Uint32Array([0, 1, 2]), // one triangle
      normals: new Float32Array([
        0, 0, 1,    // normal for vertex 0
        0, 0, 1,    // normal for vertex 1
        0, 0, 1     // normal for vertex 2
      ]),
      uvs: new Float32Array([
        0, 0,       // uv for vertex 0
        1, 0,       // uv for vertex 1
        0.5, 1      // uv for vertex 2
      ]),
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 0 }
      },
      volume: 0.5,
      surfaceArea: 1.0,
      isManifold: true
    };
  });

  describe('STL Export', () => {
    it('should export mesh as STL format', () => {
      const stlBlob = exportManager.exportSTL(mockMesh);
      
      expect(stlBlob).toBeInstanceOf(Blob);
      expect(stlBlob.type).toBe('application/sla');
    });

    it('should generate valid STL content', () => {
      const stlContent = exportManager.generateSTLContent(mockMesh);
      
      expect(stlContent).toContain('solid SoundWaveSculpture');
      expect(stlContent).toContain('endsolid SoundWaveSculpture');
      expect(stlContent).toContain('facet normal');
      expect(stlContent).toContain('outer loop');
      expect(stlContent).toContain('vertex');
      expect(stlContent).toContain('endloop');
      expect(stlContent).toContain('endfacet');
    });

    it('should include correct vertex coordinates in STL', () => {
      const stlContent = exportManager.generateSTLContent(mockMesh);
      
      expect(stlContent).toContain('vertex 0.000000 0.000000 0.000000');
      expect(stlContent).toContain('vertex 1.000000 0.000000 0.000000');
      expect(stlContent).toContain('vertex 0.500000 1.000000 0.000000');
    });

    it('should scale mesh when exporting STL', () => {
      const scaleFactor = 2.0;
      const scaledMesh = exportManager.scaleMesh(mockMesh, scaleFactor);
      const stlContent = exportManager.generateSTLContent(scaledMesh);
      
      expect(stlContent).toContain('vertex 0.000000 0.000000 0.000000');
      expect(stlContent).toContain('vertex 2.000000 0.000000 0.000000');
      expect(stlContent).toContain('vertex 1.000000 2.000000 0.000000');
    });
  });

  describe('OBJ Export', () => {
    it('should export mesh as OBJ format with MTL file', () => {
      const { obj, mtl } = exportManager.exportOBJ(mockMesh);
      
      expect(obj).toBeInstanceOf(Blob);
      expect(mtl).toBeInstanceOf(Blob);
      expect(obj.type).toBe('text/plain');
      expect(mtl.type).toBe('text/plain');
    });

    it('should generate valid OBJ content', () => {
      const objContent = exportManager.generateOBJContent(mockMesh);
      
      expect(objContent).toContain('# Sound Wave Sculptor OBJ Export');
      expect(objContent).toContain('mtllib sculpture.mtl');
      expect(objContent).toContain('usemtl SculptureMaterial');
      expect(objContent).toMatch(/^v\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+$/m); // vertex line
      expect(objContent).toMatch(/^vn\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+$/m); // normal line
      expect(objContent).toMatch(/^vt\s+[\d.-]+\s+[\d.-]+$/m); // texture coordinate line
      expect(objContent).toMatch(/^f\s+\d+\/\d+\/\d+\s+\d+\/\d+\/\d+\s+\d+\/\d+\/\d+$/m); // face line
    });

    it('should generate valid MTL content', () => {
      const mtlContent = exportManager.generateMTLContent();
      
      expect(mtlContent).toContain('# Sound Wave Sculptor Material File');
      expect(mtlContent).toContain('newmtl SculptureMaterial');
      expect(mtlContent).toContain('Ka 0.2 0.2 0.2');
      expect(mtlContent).toContain('Kd 0.8 0.8 0.8');
      expect(mtlContent).toContain('Ks 0.5 0.5 0.5');
      expect(mtlContent).toContain('Ns 32.0');
      expect(mtlContent).toContain('illum 2');
    });

    it('should use 1-based indexing for faces in OBJ', () => {
      const objContent = exportManager.generateOBJContent(mockMesh);
      
      // Should contain face with indices 1, 2, 3 (not 0, 1, 2)
      expect(objContent).toContain('f 1/1/1 2/2/2 3/3/3');
    });

    it('should handle mesh without UVs', () => {
      const meshWithoutUVs = { ...mockMesh, uvs: new Float32Array() };
      const objContent = exportManager.generateOBJContent(meshWithoutUVs);
      
      // Should use format without texture coordinates
      expect(objContent).toContain('f 1//1 2//2 3//3');
      expect(objContent).not.toMatch(/^vt\s/m);
    });
  });

  describe('Mesh Scaling', () => {
    it('should scale mesh by factor', () => {
      const scaleFactor = 2.0;
      const scaledMesh = exportManager.scaleMesh(mockMesh, scaleFactor);
      
      expect(scaledMesh.vertices[0]).toBe(0); // 0 * 2 = 0
      expect(scaledMesh.vertices[3]).toBe(2); // 1 * 2 = 2
      expect(scaledMesh.vertices[7]).toBe(2); // 1 * 2 = 2
      
      expect(scaledMesh.boundingBox.max.x).toBe(2);
      expect(scaledMesh.boundingBox.max.y).toBe(2);
      expect(scaledMesh.volume).toBe(mockMesh.volume * 8); // 2^3
      expect(scaledMesh.surfaceArea).toBe(mockMesh.surfaceArea * 4); // 2^2
    });

    it('should return original mesh when scale factor is 1', () => {
      const scaledMesh = exportManager.scaleMesh(mockMesh, 1.0);
      expect(scaledMesh).toBe(mockMesh);
    });

    it('should scale to specific dimensions', () => {
      const targetSize = { width: 10, height: 5 };
      const scaledMesh = exportManager.scaleToSize(mockMesh, targetSize);
      
      const { min, max } = scaledMesh.boundingBox;
      const actualWidth = max.x - min.x;
      const actualHeight = max.y - min.y;
      
      // Should scale to fit the smaller constraint (height = 5)
      expect(actualHeight).toBe(5);
      expect(actualWidth).toBe(5); // Maintains aspect ratio
    });

    it('should handle single dimension constraint', () => {
      const targetSize = { width: 20 };
      const scaledMesh = exportManager.scaleToSize(mockMesh, targetSize);
      
      const { min, max } = scaledMesh.boundingBox;
      const actualWidth = max.x - min.x;
      
      expect(actualWidth).toBe(20);
    });
  });

  describe('Mesh Validation', () => {
    it('should validate a good mesh', () => {
      const result = exportManager.validateMeshForExport(mockMesh);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect mesh with no vertices', () => {
      const invalidMesh = { ...mockMesh, vertices: new Float32Array() };
      const result = exportManager.validateMeshForExport(invalidMesh);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Mesh has no vertices');
    });

    it('should detect mesh with no faces', () => {
      const invalidMesh = { ...mockMesh, faces: new Uint32Array() };
      const result = exportManager.validateMeshForExport(invalidMesh);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Mesh has no faces');
    });

    it('should detect invalid vertex data', () => {
      const invalidMesh = { 
        ...mockMesh, 
        vertices: new Float32Array([0, 0, 0, 1, 0]) // Not divisible by 3
      };
      const result = exportManager.validateMeshForExport(invalidMesh);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid vertex data: vertex count not divisible by 3');
    });

    it('should detect invalid face indices', () => {
      const invalidMesh = { 
        ...mockMesh, 
        faces: new Uint32Array([0, 1, 5]) // Index 5 doesn't exist
      };
      const result = exportManager.validateMeshForExport(invalidMesh);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid face index 5');
    });

    it('should detect degenerate triangles', () => {
      const degenerateMesh = {
        ...mockMesh,
        vertices: new Float32Array([
          0, 0, 0,    // vertex 0
          0, 0, 0,    // vertex 1 (same as vertex 0)
          0, 0, 0     // vertex 2 (same as vertex 0)
        ])
      };
      const result = exportManager.validateMeshForExport(degenerateMesh);
      
      expect(result.warnings).toContain('Found 1 degenerate triangles');
      expect(result.suggestions).toContain('Consider mesh cleanup to remove degenerate triangles');
    });

    it('should warn about non-manifold mesh', () => {
      const nonManifoldMesh = { ...mockMesh, isManifold: false };
      const result = exportManager.validateMeshForExport(nonManifoldMesh);
      
      expect(result.warnings).toContain('Mesh is not manifold');
      expect(result.suggestions).toContain('Non-manifold geometry may cause issues in 3D printing');
    });

    it('should warn about very small mesh', () => {
      const smallMesh = {
        ...mockMesh,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0.5, y: 0.5, z: 0.5 }
        }
      };
      const result = exportManager.validateMeshForExport(smallMesh);
      
      expect(result.warnings).toContain('Mesh is very small (< 1 unit in some dimension)');
      expect(result.suggestions).toContain('Consider scaling the mesh for better 3D printing results');
    });
  });

  describe('Face Normal Calculation', () => {
    it('should calculate correct face normal', () => {
      // Access private method through type assertion for testing
      const calculateFaceNormal = (exportManager as any).calculateFaceNormal.bind(exportManager);
      
      const v1 = { x: 0, y: 0, z: 0 };
      const v2 = { x: 1, y: 0, z: 0 };
      const v3 = { x: 0, y: 1, z: 0 };
      
      const normal = calculateFaceNormal(v1, v2, v3);
      
      // Normal should point in positive Z direction
      expect(normal.x).toBeCloseTo(0);
      expect(normal.y).toBeCloseTo(0);
      expect(normal.z).toBeCloseTo(1);
    });

    it('should normalize face normal', () => {
      const calculateFaceNormal = (exportManager as any).calculateFaceNormal.bind(exportManager);
      
      const v1 = { x: 0, y: 0, z: 0 };
      const v2 = { x: 2, y: 0, z: 0 };
      const v3 = { x: 0, y: 2, z: 0 };
      
      const normal = calculateFaceNormal(v1, v2, v3);
      
      // Normal should be unit length
      const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
      expect(length).toBeCloseTo(1);
    });
  });

  describe('Triangle Area Calculation', () => {
    it('should calculate correct triangle area', () => {
      const calculateTriangleArea = (exportManager as any).calculateTriangleArea.bind(exportManager);
      
      const v1 = { x: 0, y: 0, z: 0 };
      const v2 = { x: 1, y: 0, z: 0 };
      const v3 = { x: 0, y: 1, z: 0 };
      
      const area = calculateTriangleArea(v1, v2, v3);
      
      // Area of right triangle with legs of length 1 should be 0.5
      expect(area).toBeCloseTo(0.5);
    });

    it('should return zero area for degenerate triangle', () => {
      const calculateTriangleArea = (exportManager as any).calculateTriangleArea.bind(exportManager);
      
      const v1 = { x: 0, y: 0, z: 0 };
      const v2 = { x: 0, y: 0, z: 0 };
      const v3 = { x: 0, y: 0, z: 0 };
      
      const area = calculateTriangleArea(v1, v2, v3);
      
      expect(area).toBeCloseTo(0);
    });
  });

  describe('3D Printing Validation', () => {
    it('should validate mesh for 3D printing', () => {
      const result = exportManager.validateForPrinting(mockMesh);
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('suggestions');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should detect thin features', () => {
      const thinMesh = {
        ...mockMesh,
        vertices: new Float32Array([
          0, 0, 0,        // vertex 0
          0.1, 0, 0,      // vertex 1 (very close to vertex 0)
          0.05, 0.1, 0    // vertex 2
        ])
      };
      
      const result = exportManager.validateForPrinting(thinMesh, { minWallThickness: 1.0 });
      
      expect(result.warnings.some(w => w.includes('thinner than'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('wall thickness'))).toBe(true);
    });

    it('should detect overhanging features', () => {
      const overhangMesh = {
        ...mockMesh,
        vertices: new Float32Array([
          0, 0, 0,      // vertex 0
          1, 0, 0,      // vertex 1
          0.5, 0, -1    // vertex 2 (creates overhang)
        ])
      };
      
      const result = exportManager.validateForPrinting(overhangMesh, { maxOverhangAngle: 30 });
      
      expect(result.warnings.some(w => w.includes('overhanging features'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('support structures'))).toBe(true);
    });

    it('should detect floating parts', () => {
      const floatingMesh = {
        ...mockMesh,
        vertices: new Float32Array([
          0, 0, 0,      // vertex 0
          1, 0, 0,      // vertex 1
          0.5, 1, 10    // vertex 2 (far from others)
        ]),
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 1, z: 10 }
        }
      };
      
      const result = exportManager.validateForPrinting(floatingMesh);
      
      expect(result.warnings.some(w => w.includes('floating'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('support structures'))).toBe(true);
    });

    it('should warn about very small models', () => {
      const smallMesh = {
        ...mockMesh,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0.5, y: 0.5, z: 0.5 }
        }
      };
      
      const result = exportManager.validateForPrinting(smallMesh);
      
      expect(result.warnings.some(w => w.includes('very small'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('scaling up'))).toBe(true);
    });

    it('should warn about very large models', () => {
      const largeMesh = {
        ...mockMesh,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 300, y: 300, z: 300 }
        }
      };
      
      const result = exportManager.validateForPrinting(largeMesh);
      
      expect(result.warnings.some(w => w.includes('large'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('printer bed'))).toBe(true);
    });

    it('should detect sharp angles', () => {
      const sharpMesh = {
        ...mockMesh,
        vertices: new Float32Array([
          0, 0, 0,        // vertex 0
          1, 0, 0,        // vertex 1
          0.01, 0.01, 0   // vertex 2 (creates very sharp angle)
        ])
      };
      
      const result = exportManager.validateForPrinting(sharpMesh);
      
      expect(result.warnings.some(w => w.includes('sharp angles'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('smoothing'))).toBe(true);
    });

    it('should use custom validation parameters', () => {
      const customOptions = {
        minWallThickness: 2.0,
        maxOverhangAngle: 30
      };
      
      const result = exportManager.validateForPrinting(mockMesh, customOptions);
      
      // Should use the custom parameters in validation
      expect(result).toBeDefined();
    });
  });

  describe('Mesh Repair', () => {
    it('should repair mesh for printing', () => {
      const repairedMesh = exportManager.repairMeshForPrinting(mockMesh);
      
      expect(repairedMesh).toHaveProperty('vertices');
      expect(repairedMesh).toHaveProperty('faces');
      expect(repairedMesh).toHaveProperty('normals');
      expect(repairedMesh.vertices).toBeInstanceOf(Float32Array);
      expect(repairedMesh.faces).toBeInstanceOf(Uint32Array);
      expect(repairedMesh.normals).toBeInstanceOf(Float32Array);
    });

    it('should remove degenerate triangles', () => {
      const degenerateMesh = {
        ...mockMesh,
        vertices: new Float32Array([
          0, 0, 0,    // vertex 0
          0, 0, 0,    // vertex 1 (duplicate)
          0, 0, 0,    // vertex 2 (duplicate)
          1, 0, 0,    // vertex 3
          0, 1, 0,    // vertex 4
          0, 0, 1     // vertex 5
        ]),
        faces: new Uint32Array([
          0, 1, 2,    // degenerate triangle
          3, 4, 5     // valid triangle
        ])
      };
      
      const repairedMesh = exportManager.repairMeshForPrinting(degenerateMesh);
      
      // Should have fewer faces after removing degenerate triangles
      expect(repairedMesh.faces.length).toBeLessThan(degenerateMesh.faces.length);
    });

    it('should merge duplicate vertices', () => {
      const duplicateVertexMesh = {
        ...mockMesh,
        vertices: new Float32Array([
          0, 0, 0,    // vertex 0
          1, 0, 0,    // vertex 1
          0, 1, 0,    // vertex 2
          0, 0, 0,    // vertex 3 (duplicate of vertex 0)
          1, 0, 0,    // vertex 4 (duplicate of vertex 1)
          0, 1, 0     // vertex 5 (duplicate of vertex 2)
        ]),
        faces: new Uint32Array([0, 1, 2, 3, 4, 5])
      };
      
      const repairedMesh = exportManager.repairMeshForPrinting(duplicateVertexMesh);
      
      // Should have fewer vertices after merging duplicates
      expect(repairedMesh.vertices.length).toBeLessThan(duplicateVertexMesh.vertices.length);
    });

    it('should recalculate normals', () => {
      const meshWithBadNormals = {
        ...mockMesh,
        normals: new Float32Array([
          0, 0, 0,    // invalid normal
          0, 0, 0,    // invalid normal
          0, 0, 0     // invalid normal
        ])
      };
      
      const repairedMesh = exportManager.repairMeshForPrinting(meshWithBadNormals);
      
      // Should have valid normals after repair
      let hasValidNormal = false;
      for (let i = 0; i < repairedMesh.normals.length; i += 3) {
        const nx = repairedMesh.normals[i];
        const ny = repairedMesh.normals[i + 1];
        const nz = repairedMesh.normals[i + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (length > 0.9) { // Should be close to unit length
          hasValidNormal = true;
          break;
        }
      }
      expect(hasValidNormal).toBe(true);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance between points', () => {
      const calculateDistance = (exportManager as any).calculateDistance.bind(exportManager);
      
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 3, y: 4, z: 0 };
      
      const distance = calculateDistance(p1, p2);
      
      expect(distance).toBeCloseTo(5); // 3-4-5 triangle
    });

    it('should return zero for identical points', () => {
      const calculateDistance = (exportManager as any).calculateDistance.bind(exportManager);
      
      const p1 = { x: 1, y: 2, z: 3 };
      const p2 = { x: 1, y: 2, z: 3 };
      
      const distance = calculateDistance(p1, p2);
      
      expect(distance).toBeCloseTo(0);
    });
  });

  describe('Triangle Angle Calculation', () => {
    it('should calculate triangle angles correctly', () => {
      const calculateTriangleAngles = (exportManager as any).calculateTriangleAngles.bind(exportManager);
      
      // Right triangle with legs of length 3 and 4
      const v1 = { x: 0, y: 0, z: 0 };
      const v2 = { x: 3, y: 0, z: 0 };
      const v3 = { x: 0, y: 4, z: 0 };
      
      const angles = calculateTriangleAngles(v1, v2, v3);
      
      expect(angles).toHaveLength(3);
      
      // One angle should be 90 degrees (π/2 radians)
      const rightAngle = angles.find(angle => Math.abs(angle - Math.PI / 2) < 0.01);
      expect(rightAngle).toBeDefined();
      
      // Sum of angles should be π
      const sum = angles.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(Math.PI);
    });

    it('should handle equilateral triangle', () => {
      const calculateTriangleAngles = (exportManager as any).calculateTriangleAngles.bind(exportManager);
      
      // Equilateral triangle
      const v1 = { x: 0, y: 0, z: 0 };
      const v2 = { x: 1, y: 0, z: 0 };
      const v3 = { x: 0.5, y: Math.sqrt(3) / 2, z: 0 };
      
      const angles = calculateTriangleAngles(v1, v2, v3);
      
      // All angles should be 60 degrees (π/3 radians)
      for (const angle of angles) {
        expect(angle).toBeCloseTo(Math.PI / 3, 2);
      }
    });
  });
});