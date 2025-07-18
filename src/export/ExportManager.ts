import { Mesh3D, ValidationResult, Point3D } from '../types';
import { ExportOptions, PrintingValidation } from './types';

export class ExportManager {
  /**
   * Export mesh as STL format for 3D printing
   */
  exportSTL(mesh: Mesh3D, scale: number = 1): Blob {
    const scaledMesh = this.scaleMesh(mesh, scale);
    const stlContent = this.generateSTLContent(scaledMesh);
    return new Blob([stlContent], { type: 'application/sla' });
  }

  /**
   * Export mesh as OBJ format with material file
   */
  exportOBJ(mesh: Mesh3D, scale: number = 1): { obj: Blob; mtl: Blob } {
    const scaledMesh = this.scaleMesh(mesh, scale);
    const objContent = this.generateOBJContent(scaledMesh);
    const mtlContent = this.generateMTLContent();
    
    return {
      obj: new Blob([objContent], { type: 'text/plain' }),
      mtl: new Blob([mtlContent], { type: 'text/plain' })
    };
  }

  /**
   * Scale mesh to specific dimensions
   */
  scaleMesh(mesh: Mesh3D, scaleFactor: number): Mesh3D {
    if (scaleFactor === 1) return mesh;

    const scaledVertices = new Float32Array(mesh.vertices.length);
    const scaledNormals = new Float32Array(mesh.normals.length);

    // Scale vertices
    for (let i = 0; i < mesh.vertices.length; i++) {
      scaledVertices[i] = mesh.vertices[i] * scaleFactor;
    }

    // Normals don't need scaling, just copy
    scaledNormals.set(mesh.normals);

    // Scale bounding box
    const scaledBoundingBox = {
      min: {
        x: mesh.boundingBox.min.x * scaleFactor,
        y: mesh.boundingBox.min.y * scaleFactor,
        z: mesh.boundingBox.min.z * scaleFactor
      },
      max: {
        x: mesh.boundingBox.max.x * scaleFactor,
        y: mesh.boundingBox.max.y * scaleFactor,
        z: mesh.boundingBox.max.z * scaleFactor
      }
    };

    return {
      ...mesh,
      vertices: scaledVertices,
      normals: scaledNormals,
      boundingBox: scaledBoundingBox,
      volume: mesh.volume * (scaleFactor ** 3),
      surfaceArea: mesh.surfaceArea * (scaleFactor ** 2)
    };
  }

  /**
   * Scale mesh to fit specific dimensions in millimeters
   */
  scaleToSize(mesh: Mesh3D, targetSize: { width?: number; height?: number; depth?: number }): Mesh3D {
    const { min, max } = mesh.boundingBox;
    const currentWidth = max.x - min.x;
    const currentHeight = max.y - min.y;
    const currentDepth = max.z - min.z;

    let scaleFactor = Infinity;

    if (targetSize.width) {
      scaleFactor = Math.min(scaleFactor, targetSize.width / currentWidth);
    }
    if (targetSize.height) {
      scaleFactor = Math.min(scaleFactor, targetSize.height / currentHeight);
    }
    if (targetSize.depth) {
      scaleFactor = Math.min(scaleFactor, targetSize.depth / currentDepth);
    }

    // If no constraints were provided, don't scale
    if (scaleFactor === Infinity) {
      scaleFactor = 1;
    }

    return this.scaleMesh(mesh, scaleFactor);
  }

  /**
   * Generate STL content as string (for testing and direct access)
   */
  generateSTLContent(mesh: Mesh3D): string {
    let stlContent = 'solid SoundWaveSculpture\n';

    // Process each triangle face
    for (let i = 0; i < mesh.faces.length; i += 3) {
      const v1Index = mesh.faces[i] * 3;
      const v2Index = mesh.faces[i + 1] * 3;
      const v3Index = mesh.faces[i + 2] * 3;

      const v1 = {
        x: mesh.vertices[v1Index],
        y: mesh.vertices[v1Index + 1],
        z: mesh.vertices[v1Index + 2]
      };
      const v2 = {
        x: mesh.vertices[v2Index],
        y: mesh.vertices[v2Index + 1],
        z: mesh.vertices[v2Index + 2]
      };
      const v3 = {
        x: mesh.vertices[v3Index],
        y: mesh.vertices[v3Index + 1],
        z: mesh.vertices[v3Index + 2]
      };

      // Calculate face normal
      const normal = this.calculateFaceNormal(v1, v2, v3);

      stlContent += `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
      stlContent += '    outer loop\n';
      stlContent += `      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(6)} ${v1.z.toFixed(6)}\n`;
      stlContent += `      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(6)} ${v2.z.toFixed(6)}\n`;
      stlContent += `      vertex ${v3.x.toFixed(6)} ${v3.y.toFixed(6)} ${v3.z.toFixed(6)}\n`;
      stlContent += '    endloop\n';
      stlContent += '  endfacet\n';
    }

    stlContent += 'endsolid SoundWaveSculpture\n';
    return stlContent;
  }

  /**
   * Generate OBJ file content
   */
  generateOBJContent(mesh: Mesh3D): string {
    let objContent = '# Sound Wave Sculptor OBJ Export\n';
    objContent += 'mtllib sculpture.mtl\n';
    objContent += 'usemtl SculptureMaterial\n\n';

    // Write vertices
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i];
      const y = mesh.vertices[i + 1];
      const z = mesh.vertices[i + 2];
      objContent += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
    }

    objContent += '\n';

    // Write normals
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const nx = mesh.normals[i];
      const ny = mesh.normals[i + 1];
      const nz = mesh.normals[i + 2];
      objContent += `vn ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`;
    }

    objContent += '\n';

    // Write texture coordinates if available
    if (mesh.uvs && mesh.uvs.length > 0) {
      for (let i = 0; i < mesh.uvs.length; i += 2) {
        const u = mesh.uvs[i];
        const v = mesh.uvs[i + 1];
        objContent += `vt ${u.toFixed(6)} ${v.toFixed(6)}\n`;
      }
      objContent += '\n';
    }

    // Write faces (OBJ uses 1-based indexing)
    for (let i = 0; i < mesh.faces.length; i += 3) {
      const f1 = mesh.faces[i] + 1;
      const f2 = mesh.faces[i + 1] + 1;
      const f3 = mesh.faces[i + 2] + 1;

      if (mesh.uvs && mesh.uvs.length > 0) {
        objContent += `f ${f1}/${f1}/${f1} ${f2}/${f2}/${f2} ${f3}/${f3}/${f3}\n`;
      } else {
        objContent += `f ${f1}//${f1} ${f2}//${f2} ${f3}//${f3}\n`;
      }
    }

    return objContent;
  }

  /**
   * Generate MTL (material) file content
   */
  generateMTLContent(): string {
    let mtlContent = '# Sound Wave Sculptor Material File\n\n';
    mtlContent += 'newmtl SculptureMaterial\n';
    mtlContent += 'Ka 0.2 0.2 0.2\n';  // Ambient color
    mtlContent += 'Kd 0.8 0.8 0.8\n';  // Diffuse color
    mtlContent += 'Ks 0.5 0.5 0.5\n';  // Specular color
    mtlContent += 'Ns 32.0\n';          // Specular exponent
    mtlContent += 'illum 2\n';          // Illumination model
    return mtlContent;
  }

  /**
   * Calculate face normal from three vertices
   */
  private calculateFaceNormal(v1: Point3D, v2: Point3D, v3: Point3D): Point3D {
    // Calculate two edge vectors
    const edge1 = {
      x: v2.x - v1.x,
      y: v2.y - v1.y,
      z: v2.z - v1.z
    };
    const edge2 = {
      x: v3.x - v1.x,
      y: v3.y - v1.y,
      z: v3.z - v1.z
    };

    // Calculate cross product
    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x
    };

    // Normalize
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    if (length > 0) {
      normal.x /= length;
      normal.y /= length;
      normal.z /= length;
    }

    return normal;
  }

  /**
   * Validate mesh for file format compliance
   */
  validateMeshForExport(mesh: Mesh3D): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Check if mesh has vertices
    if (!mesh.vertices || mesh.vertices.length === 0) {
      errors.push('Mesh has no vertices');
      return { isValid: false, warnings, errors, suggestions };
    }

    // Check if mesh has faces
    if (!mesh.faces || mesh.faces.length === 0) {
      errors.push('Mesh has no faces');
      return { isValid: false, warnings, errors, suggestions };
    }

    // Check vertex count consistency
    if (mesh.vertices.length % 3 !== 0) {
      errors.push('Invalid vertex data: vertex count not divisible by 3');
    }

    // Check face indices validity
    const maxVertexIndex = (mesh.vertices.length / 3) - 1;
    for (let i = 0; i < mesh.faces.length; i++) {
      if (mesh.faces[i] > maxVertexIndex) {
        errors.push(`Invalid face index ${mesh.faces[i]} at position ${i}`);
        break;
      }
    }

    // Check for degenerate triangles
    let degenerateCount = 0;
    for (let i = 0; i < mesh.faces.length; i += 3) {
      const v1Index = mesh.faces[i] * 3;
      const v2Index = mesh.faces[i + 1] * 3;
      const v3Index = mesh.faces[i + 2] * 3;

      const v1 = { x: mesh.vertices[v1Index], y: mesh.vertices[v1Index + 1], z: mesh.vertices[v1Index + 2] };
      const v2 = { x: mesh.vertices[v2Index], y: mesh.vertices[v2Index + 1], z: mesh.vertices[v2Index + 2] };
      const v3 = { x: mesh.vertices[v3Index], y: mesh.vertices[v3Index + 1], z: mesh.vertices[v3Index + 2] };

      const area = this.calculateTriangleArea(v1, v2, v3);
      if (area < 1e-10) {
        degenerateCount++;
      }
    }

    if (degenerateCount > 0) {
      warnings.push(`Found ${degenerateCount} degenerate triangles`);
      suggestions.push('Consider mesh cleanup to remove degenerate triangles');
    }

    // Check manifold status
    if (!mesh.isManifold) {
      warnings.push('Mesh is not manifold');
      suggestions.push('Non-manifold geometry may cause issues in 3D printing');
    }

    // Check mesh size
    const { min, max } = mesh.boundingBox;
    const size = {
      width: max.x - min.x,
      height: max.y - min.y,
      depth: max.z - min.z
    };

    if (size.width < 1 || size.height < 1 || size.depth < 1) {
      warnings.push('Mesh is very small (< 1 unit in some dimension)');
      suggestions.push('Consider scaling the mesh for better 3D printing results');
    }

    const isValid = errors.length === 0;
    return { isValid, warnings, errors, suggestions };
  }

  /**
   * Calculate triangle area
   */
  private calculateTriangleArea(v1: Point3D, v2: Point3D, v3: Point3D): number {
    const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
    const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
    
    const cross = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x
    };
    
    const length = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
    return length * 0.5;
  }

  /**
   * Validate mesh for 3D printing compatibility
   */
  validateForPrinting(mesh: Mesh3D, options: { minWallThickness?: number; maxOverhangAngle?: number } = {}): ValidationResult {
    const minWallThickness = options.minWallThickness || 0.8; // mm
    const maxOverhangAngle = options.maxOverhangAngle || 45; // degrees
    
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    // First run basic mesh validation
    const basicValidation = this.validateMeshForExport(mesh);
    warnings.push(...basicValidation.warnings);
    errors.push(...basicValidation.errors);
    suggestions.push(...basicValidation.suggestions);

    if (!basicValidation.isValid) {
      return { isValid: false, warnings, errors, suggestions };
    }

    // Check minimum wall thickness
    const thinFeatures = this.checkMinimumWallThickness(mesh, minWallThickness);
    if (thinFeatures.length > 0) {
      warnings.push(`Found ${thinFeatures.length} features thinner than ${minWallThickness}mm`);
      suggestions.push(`Consider increasing wall thickness or scaling the model up`);
      suggestions.push(`Thin features may break during printing or be unprintable`);
    }

    // Check for overhangs
    const overhangs = this.detectOverhangs(mesh, maxOverhangAngle);
    if (overhangs.length > 0) {
      warnings.push(`Found ${overhangs.length} overhanging features exceeding ${maxOverhangAngle}°`);
      suggestions.push(`Consider adding support structures for overhanging areas`);
      suggestions.push(`Rotate the model to reduce overhangs if possible`);
    }

    // Check for floating parts
    const floatingParts = this.detectFloatingParts(mesh);
    if (floatingParts.length > 0) {
      warnings.push(`Found ${floatingParts.length} floating/disconnected parts`);
      suggestions.push(`Floating parts will need support structures to print successfully`);
    }

    // Check model size for printability
    const sizeWarnings = this.checkPrintableSize(mesh);
    warnings.push(...sizeWarnings.warnings);
    suggestions.push(...sizeWarnings.suggestions);

    // Check for sharp angles that might be difficult to print
    const sharpAngles = this.detectSharpAngles(mesh);
    if (sharpAngles > 0) {
      warnings.push(`Found ${sharpAngles} very sharp angles that may be difficult to print`);
      suggestions.push(`Consider smoothing sharp edges for better print quality`);
    }

    const isValid = errors.length === 0;
    return { isValid, warnings, errors, suggestions };
  }

  /**
   * Check for features thinner than minimum wall thickness
   */
  private checkMinimumWallThickness(mesh: Mesh3D, minThickness: number): Point3D[] {
    const thinFeatures: Point3D[] = [];
    
    // This is a simplified implementation
    // In a real implementation, you would need more sophisticated geometry analysis
    // For now, we'll check for very small triangles which might indicate thin features
    
    for (let i = 0; i < mesh.faces.length; i += 3) {
      const v1Index = mesh.faces[i] * 3;
      const v2Index = mesh.faces[i + 1] * 3;
      const v3Index = mesh.faces[i + 2] * 3;

      const v1 = { x: mesh.vertices[v1Index], y: mesh.vertices[v1Index + 1], z: mesh.vertices[v1Index + 2] };
      const v2 = { x: mesh.vertices[v2Index], y: mesh.vertices[v2Index + 1], z: mesh.vertices[v2Index + 2] };
      const v3 = { x: mesh.vertices[v3Index], y: mesh.vertices[v3Index + 1], z: mesh.vertices[v3Index + 2] };

      // Check edge lengths
      const edge1Length = this.calculateDistance(v1, v2);
      const edge2Length = this.calculateDistance(v2, v3);
      const edge3Length = this.calculateDistance(v3, v1);

      if (edge1Length < minThickness || edge2Length < minThickness || edge3Length < minThickness) {
        thinFeatures.push(v1, v2, v3);
      }
    }

    return thinFeatures;
  }

  /**
   * Detect overhanging features that exceed the maximum angle
   */
  private detectOverhangs(mesh: Mesh3D, maxAngle: number): Point3D[] {
    const overhangs: Point3D[] = [];
    const maxAngleRad = (maxAngle * Math.PI) / 180;
    
    for (let i = 0; i < mesh.faces.length; i += 3) {
      const v1Index = mesh.faces[i] * 3;
      const v2Index = mesh.faces[i + 1] * 3;
      const v3Index = mesh.faces[i + 2] * 3;

      const v1 = { x: mesh.vertices[v1Index], y: mesh.vertices[v1Index + 1], z: mesh.vertices[v1Index + 2] };
      const v2 = { x: mesh.vertices[v2Index], y: mesh.vertices[v2Index + 1], z: mesh.vertices[v2Index + 2] };
      const v3 = { x: mesh.vertices[v3Index], y: mesh.vertices[v3Index + 1], z: mesh.vertices[v3Index + 2] };

      const normal = this.calculateFaceNormal(v1, v2, v3);
      
      // Calculate angle between face normal and vertical (Z-axis)
      const verticalDot = Math.abs(normal.z);
      const angle = Math.acos(Math.min(1, Math.max(-1, verticalDot)));
      
      // If angle is greater than max overhang angle, it's an overhang
      if (angle > maxAngleRad) {
        overhangs.push(v1, v2, v3);
      }
    }

    return overhangs;
  }

  /**
   * Detect floating/disconnected parts
   */
  private detectFloatingParts(mesh: Mesh3D): Point3D[][] {
    // This is a simplified implementation
    // A proper implementation would use graph traversal to find connected components
    const floatingParts: Point3D[][] = [];
    
    // For now, we'll check if any vertices are significantly separated from the main body
    const { min, max } = mesh.boundingBox;
    const centerZ = (min.z + max.z) / 2;
    const heightThreshold = (max.z - min.z) * 0.1; // 10% of total height
    
    const isolatedVertices: Point3D[] = [];
    
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const vertex = {
        x: mesh.vertices[i],
        y: mesh.vertices[i + 1],
        z: mesh.vertices[i + 2]
      };
      
      // Check if vertex is far from the center Z level
      if (Math.abs(vertex.z - centerZ) > heightThreshold) {
        isolatedVertices.push(vertex);
      }
    }
    
    if (isolatedVertices.length > 0) {
      floatingParts.push(isolatedVertices);
    }
    
    return floatingParts;
  }

  /**
   * Check if model size is suitable for 3D printing
   */
  private checkPrintableSize(mesh: Mesh3D): { warnings: string[]; suggestions: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    const { min, max } = mesh.boundingBox;
    const width = max.x - min.x;
    const height = max.y - min.y;
    const depth = max.z - min.z;
    
    // Check if model is too small (assuming units are mm)
    const minPrintableSize = 2; // 2mm minimum
    if (width < minPrintableSize || height < minPrintableSize || depth < minPrintableSize) {
      warnings.push(`Model is very small (${width.toFixed(1)}×${height.toFixed(1)}×${depth.toFixed(1)}mm)`);
      suggestions.push(`Consider scaling up the model for better printability`);
      suggestions.push(`Very small models may lose detail or be difficult to print`);
    }
    
    // Check if model is too large (assuming typical printer bed size)
    const maxPrintableSize = 200; // 200mm typical bed size
    if (width > maxPrintableSize || height > maxPrintableSize || depth > maxPrintableSize) {
      warnings.push(`Model is large (${width.toFixed(1)}×${height.toFixed(1)}×${depth.toFixed(1)}mm)`);
      suggestions.push(`Check if your printer bed can accommodate this size`);
      suggestions.push(`Consider scaling down or splitting into multiple parts`);
    }
    
    return { warnings, suggestions };
  }

  /**
   * Detect sharp angles that might be difficult to print
   */
  private detectSharpAngles(mesh: Mesh3D): number {
    let sharpAngleCount = 0;
    const sharpAngleThreshold = 15; // degrees
    const thresholdRad = (sharpAngleThreshold * Math.PI) / 180;
    
    for (let i = 0; i < mesh.faces.length; i += 3) {
      const v1Index = mesh.faces[i] * 3;
      const v2Index = mesh.faces[i + 1] * 3;
      const v3Index = mesh.faces[i + 2] * 3;

      const v1 = { x: mesh.vertices[v1Index], y: mesh.vertices[v1Index + 1], z: mesh.vertices[v1Index + 2] };
      const v2 = { x: mesh.vertices[v2Index], y: mesh.vertices[v2Index + 1], z: mesh.vertices[v2Index + 2] };
      const v3 = { x: mesh.vertices[v3Index], y: mesh.vertices[v3Index + 1], z: mesh.vertices[v3Index + 2] };

      // Calculate angles at each vertex of the triangle
      const angles = this.calculateTriangleAngles(v1, v2, v3);
      
      for (const angle of angles) {
        if (angle < thresholdRad) {
          sharpAngleCount++;
        }
      }
    }
    
    return sharpAngleCount;
  }

  /**
   * Calculate the three angles of a triangle
   */
  private calculateTriangleAngles(v1: Point3D, v2: Point3D, v3: Point3D): number[] {
    const a = this.calculateDistance(v2, v3);
    const b = this.calculateDistance(v1, v3);
    const c = this.calculateDistance(v1, v2);
    
    // Use law of cosines to calculate angles
    const angleA = Math.acos(Math.min(1, Math.max(-1, (b * b + c * c - a * a) / (2 * b * c))));
    const angleB = Math.acos(Math.min(1, Math.max(-1, (a * a + c * c - b * b) / (2 * a * c))));
    const angleC = Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - c * c) / (2 * a * b))));
    
    return [angleA, angleB, angleC];
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(p1: Point3D, p2: Point3D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Repair mesh for better 3D printing compatibility
   */
  repairMeshForPrinting(mesh: Mesh3D): Mesh3D {
    // This is a simplified repair implementation
    // A full implementation would include more sophisticated repair algorithms
    
    let repairedMesh = { ...mesh };
    
    // Remove degenerate triangles
    repairedMesh = this.removeDegenerateTriangles(repairedMesh);
    
    // Merge duplicate vertices
    repairedMesh = this.mergeDuplicateVertices(repairedMesh);
    
    // Recalculate normals
    repairedMesh = this.recalculateNormals(repairedMesh);
    
    return repairedMesh;
  }

  /**
   * Remove degenerate triangles from mesh
   */
  private removeDegenerateTriangles(mesh: Mesh3D): Mesh3D {
    const validFaces: number[] = [];
    const minArea = 1e-10;
    
    for (let i = 0; i < mesh.faces.length; i += 3) {
      const v1Index = mesh.faces[i] * 3;
      const v2Index = mesh.faces[i + 1] * 3;
      const v3Index = mesh.faces[i + 2] * 3;

      const v1 = { x: mesh.vertices[v1Index], y: mesh.vertices[v1Index + 1], z: mesh.vertices[v1Index + 2] };
      const v2 = { x: mesh.vertices[v2Index], y: mesh.vertices[v2Index + 1], z: mesh.vertices[v2Index + 2] };
      const v3 = { x: mesh.vertices[v3Index], y: mesh.vertices[v3Index + 1], z: mesh.vertices[v3Index + 2] };

      const area = this.calculateTriangleArea(v1, v2, v3);
      
      if (area > minArea) {
        validFaces.push(mesh.faces[i], mesh.faces[i + 1], mesh.faces[i + 2]);
      }
    }
    
    return {
      ...mesh,
      faces: new Uint32Array(validFaces)
    };
  }

  /**
   * Merge duplicate vertices (simplified implementation)
   */
  private mergeDuplicateVertices(mesh: Mesh3D): Mesh3D {
    // This is a simplified implementation
    // A proper implementation would use spatial hashing for efficiency
    const tolerance = 1e-6;
    const uniqueVertices: number[] = [];
    const vertexMap: Map<string, number> = new Map();
    const newFaces: number[] = [];
    
    // Build unique vertex list
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i];
      const y = mesh.vertices[i + 1];
      const z = mesh.vertices[i + 2];
      
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
      
      if (!vertexMap.has(key)) {
        const newIndex = uniqueVertices.length / 3;
        vertexMap.set(key, newIndex);
        uniqueVertices.push(x, y, z);
      }
    }
    
    // Remap faces to use new vertex indices
    for (let i = 0; i < mesh.faces.length; i++) {
      const oldVertexIndex = mesh.faces[i];
      const x = mesh.vertices[oldVertexIndex * 3];
      const y = mesh.vertices[oldVertexIndex * 3 + 1];
      const z = mesh.vertices[oldVertexIndex * 3 + 2];
      
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
      const newVertexIndex = vertexMap.get(key)!;
      newFaces.push(newVertexIndex);
    }
    
    return {
      ...mesh,
      vertices: new Float32Array(uniqueVertices),
      faces: new Uint32Array(newFaces)
    };
  }

  /**
   * Recalculate vertex normals
   */
  private recalculateNormals(mesh: Mesh3D): Mesh3D {
    const normals = new Float32Array(mesh.vertices.length);
    const vertexNormalCounts = new Float32Array(mesh.vertices.length / 3);
    
    // Calculate face normals and accumulate at vertices
    for (let i = 0; i < mesh.faces.length; i += 3) {
      const v1Index = mesh.faces[i];
      const v2Index = mesh.faces[i + 1];
      const v3Index = mesh.faces[i + 2];

      const v1 = {
        x: mesh.vertices[v1Index * 3],
        y: mesh.vertices[v1Index * 3 + 1],
        z: mesh.vertices[v1Index * 3 + 2]
      };
      const v2 = {
        x: mesh.vertices[v2Index * 3],
        y: mesh.vertices[v2Index * 3 + 1],
        z: mesh.vertices[v2Index * 3 + 2]
      };
      const v3 = {
        x: mesh.vertices[v3Index * 3],
        y: mesh.vertices[v3Index * 3 + 1],
        z: mesh.vertices[v3Index * 3 + 2]
      };

      const faceNormal = this.calculateFaceNormal(v1, v2, v3);
      
      // Add face normal to each vertex
      [v1Index, v2Index, v3Index].forEach(vertexIndex => {
        normals[vertexIndex * 3] += faceNormal.x;
        normals[vertexIndex * 3 + 1] += faceNormal.y;
        normals[vertexIndex * 3 + 2] += faceNormal.z;
        vertexNormalCounts[vertexIndex]++;
      });
    }
    
    // Normalize accumulated normals
    for (let i = 0; i < normals.length; i += 3) {
      const vertexIndex = i / 3;
      const count = vertexNormalCounts[vertexIndex];
      
      if (count > 0) {
        normals[i] /= count;
        normals[i + 1] /= count;
        normals[i + 2] /= count;
        
        // Normalize the normal vector
        const length = Math.sqrt(normals[i] * normals[i] + normals[i + 1] * normals[i + 1] + normals[i + 2] * normals[i + 2]);
        if (length > 0) {
          normals[i] /= length;
          normals[i + 1] /= length;
          normals[i + 2] /= length;
        }
      }
    }
    
    return {
      ...mesh,
      normals
    };
  }
}