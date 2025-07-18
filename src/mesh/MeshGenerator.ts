import { AudioFeatures, SculptureParams, Mesh3D, Point3D, BoundingBox, FrequencyMapping, ValidationResult } from '../types';
import { globalErrorHandler } from '../errors/ErrorHandler';
import { ProgressTracker } from '../errors/ProgressTracker';
import { ErrorCategory, ErrorSeverity } from '../errors/ErrorTypes';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';

export class MeshGenerator {
  private resolution: number;
  private performanceMonitor: PerformanceMonitor;
  private optimizedSettings: boolean = true;

  constructor(resolution: number = 64) {
    this.performanceMonitor = new PerformanceMonitor();
    
    // Adjust resolution based on device capabilities
    const qualitySettings = this.performanceMonitor.getQualitySettings();
    this.resolution = qualitySettings.meshResolution || resolution;
    
    // Enable optimizations for low-end devices
    const deviceCaps = this.performanceMonitor.getDeviceCapabilities();
    this.optimizedSettings = deviceCaps.isLowEndDevice;
  }

  /**
   * Generate a 3D mesh from audio features and sculpture parameters with progress tracking
   * Uses performance monitoring and automatic optimization
   */
  generateFromAudio(audioFeatures: AudioFeatures, params: SculptureParams, progressTracker?: ProgressTracker): Mesh3D {
    return this.performanceMonitor.measureOperation('mesh-generation', () => {
      return this.generateFromAudioInternal(audioFeatures, params, progressTracker);
    });
  }

  /**
   * Internal mesh generation with performance optimizations
   */
  private generateFromAudioInternal(audioFeatures: AudioFeatures, params: SculptureParams, progressTracker?: ProgressTracker): Mesh3D {
    try {
      // Check memory usage before processing
      const estimatedVertices = this.resolution * this.resolution;
      const memoryEstimate = globalErrorHandler.estimateMemoryUsage(
        { length: audioFeatures.frequencyData.length * 1024, numberOfChannels: 1, sampleRate: 44100 } as AudioBuffer,
        this.resolution
      );
      
      if (!memoryEstimate.safe) {
        throw globalErrorHandler.createMemoryLimitationError(
          'mesh generation',
          memoryEstimate.estimated,
          memoryEstimate.available
        );
      }

      // Validate input data
      if (!audioFeatures.frequencyData || audioFeatures.frequencyData.length === 0) {
        throw globalErrorHandler.createError(
          ErrorCategory.MESH_GENERATION,
          ErrorSeverity.HIGH,
          'INVALID_AUDIO_DATA',
          'Audio features data is missing or empty',
          [
            {
              type: 'retry',
              label: 'Reprocess Audio',
              description: 'Try processing the audio file again',
              action: () => {}
            }
          ],
          [
            {
              title: 'Check Audio File',
              description: 'Ensure the audio file is valid and not corrupted'
            }
          ]
        );
      }

      // Create base cylindrical structure
      const baseRadius = 1.0;
      const baseHeight = 2.0;
      
      // Generate vertices using frequency-to-height and amplitude-to-radius mapping
      const vertices: number[] = [];
      const faces: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];

      // Create frequency mapping
      const frequencyMapping = this.createFrequencyMapping(audioFeatures);
      
      // Generate vertices in cylindrical coordinates
      const radialSegments = Math.max(8, Math.floor(this.resolution / 4));
      const heightSegments = Math.max(8, Math.floor(this.resolution / 4));
      const totalVertices = (heightSegments + 1) * (radialSegments + 1);
      let processedVertices = 0;
      
      for (let h = 0; h <= heightSegments; h++) {
        // Check if operation was cancelled
        if (progressTracker?.isCancelled()) {
          throw globalErrorHandler.createError(
            ErrorCategory.MESH_GENERATION,
            ErrorSeverity.MEDIUM,
            'OPERATION_CANCELLED',
            'Mesh generation was cancelled by user'
          );
        }

        const heightRatio = h / heightSegments;
        const timeIndex = Math.floor(heightRatio * (audioFeatures.frequencyData.length - 1));
        
        // Get height from frequency mapping
        const height = this.mapFrequencyToHeight(
          audioFeatures.frequencyData[timeIndex] || new Float32Array(1024),
          params.frequencyMapping,
          baseHeight
        );
        
        // Get radius from amplitude mapping
        const amplitude = audioFeatures.amplitudeEnvelope[timeIndex] || 0;
        const radius = this.mapAmplitudeToRadius(amplitude, params.amplitudeMapping, baseRadius);
        
        for (let r = 0; r <= radialSegments; r++) {
          const angle = (r / radialSegments) * Math.PI * 2;
          
          // Calculate vertex position
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = height * heightRatio;
          
          vertices.push(x, y, z);
          
          // Calculate UV coordinates
          uvs.push(r / radialSegments, heightRatio);
          
          processedVertices++;
        }

        // Update progress for vertex generation (50% of total work)
        if (progressTracker && h % Math.max(1, Math.floor(heightSegments / 10)) === 0) {
          const vertexProgress = (processedVertices / totalVertices) * 50;
          progressTracker.updateStepProgress('mesh-generation', vertexProgress, 
            `Generating vertices: ${processedVertices}/${totalVertices}`);
        }
      }

      // Generate faces (triangles)
      const totalFaces = heightSegments * radialSegments * 2;
      let processedFaces = 0;
      
      for (let h = 0; h < heightSegments; h++) {
        if (progressTracker?.isCancelled()) {
          throw globalErrorHandler.createError(
            ErrorCategory.MESH_GENERATION,
            ErrorSeverity.MEDIUM,
            'OPERATION_CANCELLED',
            'Mesh generation was cancelled by user'
          );
        }

        for (let r = 0; r < radialSegments; r++) {
          const current = h * (radialSegments + 1) + r;
          const next = current + radialSegments + 1;
          
          // Create two triangles for each quad
          faces.push(current, next, current + 1);
          faces.push(next, next + 1, current + 1);
          
          processedFaces += 2;
        }

        // Update progress for face generation (25% of total work, starting at 50%)
        if (progressTracker && h % Math.max(1, Math.floor(heightSegments / 5)) === 0) {
          const faceProgress = 50 + (processedFaces / totalFaces) * 25;
          progressTracker.updateStepProgress('mesh-generation', faceProgress, 
            `Generating faces: ${processedFaces}/${totalFaces}`);
        }
      }

      // Calculate normals (25% of total work, starting at 75%)
      if (progressTracker) {
        progressTracker.updateStepProgress('mesh-generation', 75, 'Calculating normals...');
      }
      
      const vertexNormals = this.calculateNormals(vertices, faces);
      normals.push(...vertexNormals);

      // Create mesh data structure and validate
      if (progressTracker) {
        progressTracker.updateStepProgress('mesh-generation', 90, 'Finalizing mesh...');
      }

      const mesh: Mesh3D = {
        vertices: new Float32Array(vertices),
        faces: new Uint32Array(faces),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        boundingBox: this.calculateBoundingBox(vertices),
        volume: this.calculateVolume(vertices, faces),
        surfaceArea: this.calculateSurfaceArea(vertices, faces),
        isManifold: this.isManifoldGeometry(vertices, faces)
      };

      // Validate mesh integrity
      const validation = this.validateMeshIntegrity(mesh);
      if (!validation.isValid) {
        // Log warnings but don't fail - attempt automatic repair
        console.warn('Generated mesh has issues:', validation.errors);
        
        if (progressTracker) {
          progressTracker.updateStepProgress('mesh-generation', 95, 'Repairing mesh issues...');
        }
        
        const repairedMesh = this.repairNonManifoldGeometry(mesh);
        
        if (progressTracker) {
          progressTracker.updateStepProgress('mesh-generation', 100, 'Mesh generation complete');
        }
        
        return repairedMesh;
      }

      if (progressTracker) {
        progressTracker.updateStepProgress('mesh-generation', 100, 'Mesh generation complete');
      }

      return mesh;
    } catch (error) {
      if (error instanceof Error) {
        globalErrorHandler.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Create frequency mapping ranges based on audio data
   */
  private createFrequencyMapping(audioFeatures: AudioFeatures): FrequencyMapping {
    const sampleRate = 44100; // Assume standard sample rate
    const fftSize = audioFeatures.frequencyData[0]?.length || 1024;
    const nyquist = sampleRate / 2;
    
    return {
      lowFreq: { min: 0, max: nyquist * 0.1 },      // 0-4.4kHz
      midFreq: { min: nyquist * 0.1, max: nyquist * 0.4 }, // 4.4-8.8kHz
      highFreq: { min: nyquist * 0.4, max: nyquist }       // 8.8-22kHz
    };
  }

  /**
   * Map frequency data to height using the frequency mapping parameters
   */
  private mapFrequencyToHeight(
    frequencyData: Float32Array,
    mapping: SculptureParams['frequencyMapping'],
    baseHeight: number
  ): number {
    const fftSize = frequencyData.length;
    const lowBand = frequencyData.slice(0, Math.floor(fftSize * 0.1));
    const midBand = frequencyData.slice(Math.floor(fftSize * 0.1), Math.floor(fftSize * 0.4));
    const highBand = frequencyData.slice(Math.floor(fftSize * 0.4));

    // Calculate average magnitude for each band
    const lowAvg = this.calculateAverage(lowBand);
    const midAvg = this.calculateAverage(midBand);
    const highAvg = this.calculateAverage(highBand);

    // Apply mapping weights with more pronounced differences
    // Use the mapping parameters more directly to create significant differences
    const heightMultiplier = 
      (lowAvg * mapping.lowFreqToHeight * 5.0) +           // Primary height influence - much stronger effect
      (midAvg * mapping.midFreqToWidth * 2.0) +           // Secondary influence from mid frequencies
      (highAvg * mapping.highFreqToDepth * 1.0);          // Tertiary influence from high frequencies

    const result = baseHeight * (0.2 + heightMultiplier * 4.0); // Scale between 0.2x and 4.2x base height for more variation
    

    
    return result;
  }

  /**
   * Map amplitude to radius displacement
   */
  private mapAmplitudeToRadius(
    amplitude: number,
    mapping: SculptureParams['amplitudeMapping'],
    baseRadius: number
  ): number {
    // Apply sensitivity and smoothing with more pronounced effects
    const sensitizedAmplitude = amplitude * mapping.sensitivity * 3.0; // Amplify sensitivity effect
    const displacement = sensitizedAmplitude * mapping.smoothing * 2.0; // Amplify smoothing effect
    
    return baseRadius * (0.2 + displacement * 2.5); // Scale between 0.2x and 2.7x base radius for much more variation
  }

  /**
   * Calculate vertex normals for smooth shading
   */
  private calculateNormals(vertices: number[], faces: number[]): number[] {
    const normals = new Array(vertices.length).fill(0);
    
    // Calculate face normals and accumulate to vertex normals
    for (let i = 0; i < faces.length; i += 3) {
      const i1 = faces[i] * 3;
      const i2 = faces[i + 1] * 3;
      const i3 = faces[i + 2] * 3;
      
      // Get triangle vertices
      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
      const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]];
      
      // Calculate face normal using cross product
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
      
      const normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
      ];
      
      // Normalize
      const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      if (length > 0) {
        normal[0] /= length;
        normal[1] /= length;
        normal[2] /= length;
      }
      
      // Accumulate to vertex normals
      normals[i1] += normal[0];
      normals[i1 + 1] += normal[1];
      normals[i1 + 2] += normal[2];
      
      normals[i2] += normal[0];
      normals[i2 + 1] += normal[1];
      normals[i2 + 2] += normal[2];
      
      normals[i3] += normal[0];
      normals[i3 + 1] += normal[1];
      normals[i3 + 2] += normal[2];
    }
    
    // Normalize vertex normals
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.sqrt(normals[i] * normals[i] + normals[i + 1] * normals[i + 1] + normals[i + 2] * normals[i + 2]);
      if (length > 0) {
        normals[i] /= length;
        normals[i + 1] /= length;
        normals[i + 2] /= length;
      }
    }
    
    return normals;
  }

  /**
   * Calculate bounding box of the mesh
   */
  private calculateBoundingBox(vertices: number[]): BoundingBox {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  /**
   * Calculate approximate volume using divergence theorem
   */
  private calculateVolume(vertices: number[], faces: number[]): number {
    let volume = 0;
    
    for (let i = 0; i < faces.length; i += 3) {
      const i1 = faces[i] * 3;
      const i2 = faces[i + 1] * 3;
      const i3 = faces[i + 2] * 3;
      
      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
      const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]];
      
      // Calculate signed volume of tetrahedron formed by triangle and origin
      volume += (v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) +
                 v2[0] * (v3[1] * v1[2] - v3[2] * v1[1]) +
                 v3[0] * (v1[1] * v2[2] - v1[2] * v2[1])) / 6;
    }
    
    return Math.abs(volume);
  }

  /**
   * Calculate surface area of the mesh
   */
  private calculateSurfaceArea(vertices: number[], faces: number[]): number {
    let area = 0;
    
    for (let i = 0; i < faces.length; i += 3) {
      const i1 = faces[i] * 3;
      const i2 = faces[i + 1] * 3;
      const i3 = faces[i + 2] * 3;
      
      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
      const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]];
      
      // Calculate triangle area using cross product
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
      
      const cross = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
      ];
      
      const length = Math.sqrt(cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]);
      area += length * 0.5;
    }
    
    return area;
  }

  /**
   * Basic manifold check - ensures each edge is shared by exactly 2 faces
   */
  private isManifoldGeometry(vertices: number[], faces: number[]): boolean {
    const edgeCount = new Map<string, number>();
    
    for (let i = 0; i < faces.length; i += 3) {
      const v1 = faces[i];
      const v2 = faces[i + 1];
      const v3 = faces[i + 2];
      
      // Check each edge of the triangle
      const edges = [
        [Math.min(v1, v2), Math.max(v1, v2)],
        [Math.min(v2, v3), Math.max(v2, v3)],
        [Math.min(v3, v1), Math.max(v3, v1)]
      ];
      
      for (const edge of edges) {
        const key = `${edge[0]}-${edge[1]}`;
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
      }
    }
    
    // Check if any edge is shared by more than 2 faces
    for (const count of edgeCount.values()) {
      if (count > 2) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate average of array values
   */
  private calculateAverage(array: Float32Array): number {
    if (array.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < array.length; i++) {
      sum += array[i];
    }
    
    return sum / array.length;
  }

  /**
   * Validate mesh manifold properties and return detailed validation result
   */
  validateMeshIntegrity(mesh: Mesh3D): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Check manifold properties
    const manifoldResult = this.validateManifoldGeometry(mesh.vertices, mesh.faces);
    if (!manifoldResult.isValid) {
      errors.push('Mesh is not manifold');
      errors.push(...manifoldResult.errors);
      suggestions.push('Use repairNonManifoldGeometry() to fix manifold issues');
    }

    // Check for degenerate triangles
    const degenerateTriangles = this.findDegenerateTriangles(mesh.vertices, mesh.faces);
    if (degenerateTriangles.length > 0) {
      warnings.push(`Found ${degenerateTriangles.length} degenerate triangles`);
      suggestions.push('Consider increasing mesh resolution or smoothing parameters');
    }

    // Check for minimum wall thickness (for 3D printing)
    const minThickness = this.calculateMinimumWallThickness(mesh.vertices, mesh.faces);
    if (minThickness < 0.8) { // 0.8mm minimum for most 3D printers
      warnings.push(`Minimum wall thickness (${minThickness.toFixed(2)}mm) may be too thin for 3D printing`);
      suggestions.push('Consider scaling the model up or adjusting parameters for thicker walls');
    }

    // Check mesh bounds
    const bounds = mesh.boundingBox;
    const maxDimension = Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z
    );
    
    if (maxDimension > 200) { // 200mm max dimension warning
      warnings.push(`Model is large (${maxDimension.toFixed(1)}mm max dimension)`);
      suggestions.push('Consider scaling down for 3D printing or check printer bed size');
    }

    // Check for isolated vertices
    const isolatedVertices = this.findIsolatedVertices(mesh.vertices, mesh.faces);
    if (isolatedVertices.length > 0) {
      warnings.push(`Found ${isolatedVertices.length} isolated vertices`);
      suggestions.push('Remove unused vertices to optimize mesh');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      suggestions
    };
  }

  /**
   * Detailed manifold validation with specific error reporting
   */
  private validateManifoldGeometry(vertices: Float32Array, faces: Uint32Array): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Build edge-to-face mapping
    const edgeToFaces = new Map<string, number[]>();
    const vertexToFaces = new Map<number, number[]>();

    for (let i = 0; i < faces.length; i += 3) {
      const faceIndex = Math.floor(i / 3);
      const v1 = faces[i];
      const v2 = faces[i + 1];
      const v3 = faces[i + 2];

      // Track vertex-to-face relationships
      [v1, v2, v3].forEach(vertex => {
        if (!vertexToFaces.has(vertex)) {
          vertexToFaces.set(vertex, []);
        }
        vertexToFaces.get(vertex)!.push(faceIndex);
      });

      // Track edge-to-face relationships
      const edges = [
        [Math.min(v1, v2), Math.max(v1, v2)],
        [Math.min(v2, v3), Math.max(v2, v3)],
        [Math.min(v3, v1), Math.max(v3, v1)]
      ];

      for (const edge of edges) {
        const key = `${edge[0]}-${edge[1]}`;
        if (!edgeToFaces.has(key)) {
          edgeToFaces.set(key, []);
        }
        edgeToFaces.get(key)!.push(faceIndex);
      }
    }

    // Check for non-manifold edges (shared by more than 2 faces)
    let nonManifoldEdges = 0;
    for (const [edge, faceList] of edgeToFaces) {
      if (faceList.length > 2) {
        nonManifoldEdges++;
        errors.push(`Edge ${edge} is shared by ${faceList.length} faces (non-manifold)`);
      } else if (faceList.length === 1) {
        warnings.push(`Edge ${edge} is a boundary edge (shared by only 1 face)`);
      }
    }

    // Check for non-manifold vertices
    let nonManifoldVertices = 0;
    for (const [vertex, faceList] of vertexToFaces) {
      // A vertex is non-manifold if its adjacent faces don't form a single fan
      if (faceList.length > 0) {
        const isManifoldVertex = this.isVertexManifold(vertex, faceList, edgeToFaces);
        if (!isManifoldVertex) {
          nonManifoldVertices++;
          errors.push(`Vertex ${vertex} is non-manifold`);
        }
      }
    }

    if (nonManifoldEdges > 0) {
      suggestions.push('Use mesh repair algorithms to fix non-manifold edges');
    }
    if (nonManifoldVertices > 0) {
      suggestions.push('Use vertex welding or mesh cleanup to fix non-manifold vertices');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      suggestions
    };
  }

  /**
   * Check if a vertex is manifold (its adjacent faces form a single fan)
   */
  private isVertexManifold(vertex: number, adjacentFaces: number[], edgeToFaces: Map<string, number[]>): boolean {
    if (adjacentFaces.length < 3) return true; // Boundary vertices are considered manifold

    // For a vertex to be manifold, we should be able to traverse around it
    // in a single loop through the adjacent faces
    const visitedFaces = new Set<number>();
    const faceQueue = [adjacentFaces[0]];
    
    while (faceQueue.length > 0) {
      const currentFace = faceQueue.shift()!;
      if (visitedFaces.has(currentFace)) continue;
      
      visitedFaces.add(currentFace);
      
      // Find neighboring faces that share an edge with current face and contain the vertex
      for (const otherFace of adjacentFaces) {
        if (visitedFaces.has(otherFace)) continue;
        
        // Check if faces share an edge
        if (this.facesShareEdge(currentFace, otherFace, edgeToFaces)) {
          faceQueue.push(otherFace);
        }
      }
    }

    // If we visited all faces, the vertex is manifold
    return visitedFaces.size === adjacentFaces.length;
  }

  /**
   * Check if two faces share an edge
   */
  private facesShareEdge(face1: number, face2: number, edgeToFaces: Map<string, number[]>): boolean {
    for (const [edge, faces] of edgeToFaces) {
      if (faces.includes(face1) && faces.includes(face2)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find degenerate triangles (zero area or invalid)
   */
  private findDegenerateTriangles(vertices: Float32Array, faces: Uint32Array): number[] {
    const degenerateTriangles: number[] = [];

    for (let i = 0; i < faces.length; i += 3) {
      const faceIndex = Math.floor(i / 3);
      const i1 = faces[i] * 3;
      const i2 = faces[i + 1] * 3;
      const i3 = faces[i + 2] * 3;

      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
      const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]];

      // Check for duplicate vertices
      if (this.vectorsEqual(v1, v2) || this.vectorsEqual(v2, v3) || this.vectorsEqual(v3, v1)) {
        degenerateTriangles.push(faceIndex);
        continue;
      }

      // Calculate triangle area using cross product
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

      const cross = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
      ];

      const area = Math.sqrt(cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]) * 0.5;

      // Triangle is degenerate if area is very small
      if (area < 1e-10) {
        degenerateTriangles.push(faceIndex);
      }
    }

    return degenerateTriangles;
  }

  /**
   * Calculate minimum wall thickness for 3D printing validation
   */
  private calculateMinimumWallThickness(vertices: Float32Array, faces: Uint32Array): number {
    // Simplified approach: find the minimum distance between non-adjacent vertices
    let minDistance = Infinity;
    const vertexCount = vertices.length / 3;

    // Sample a subset of vertices for performance (checking all pairs would be O(n²))
    const sampleSize = Math.min(100, vertexCount);
    const step = Math.max(1, Math.floor(vertexCount / sampleSize));

    for (let i = 0; i < vertexCount; i += step) {
      const v1 = [vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]];
      
      for (let j = i + step; j < vertexCount; j += step) {
        const v2 = [vertices[j * 3], vertices[j * 3 + 1], vertices[j * 3 + 2]];
        
        const distance = Math.sqrt(
          (v2[0] - v1[0]) ** 2 + 
          (v2[1] - v1[1]) ** 2 + 
          (v2[2] - v1[2]) ** 2
        );
        
        if (distance > 0 && distance < minDistance) {
          minDistance = distance;
        }
      }
    }

    return minDistance === Infinity ? 0 : minDistance;
  }

  /**
   * Find isolated vertices (not referenced by any face)
   */
  private findIsolatedVertices(vertices: Float32Array, faces: Uint32Array): number[] {
    const vertexCount = vertices.length / 3;
    const usedVertices = new Set<number>();

    // Mark all vertices used by faces
    for (let i = 0; i < faces.length; i++) {
      usedVertices.add(faces[i]);
    }

    // Find unused vertices
    const isolatedVertices: number[] = [];
    for (let i = 0; i < vertexCount; i++) {
      if (!usedVertices.has(i)) {
        isolatedVertices.push(i);
      }
    }

    return isolatedVertices;
  }

  /**
   * Repair non-manifold geometry by removing problematic elements
   */
  repairNonManifoldGeometry(mesh: Mesh3D): Mesh3D {
    let vertices = Array.from(mesh.vertices);
    let faces = Array.from(mesh.faces);

    // Remove degenerate triangles
    const degenerateTriangles = this.findDegenerateTriangles(new Float32Array(vertices), new Uint32Array(faces));
    if (degenerateTriangles.length > 0) {
      // Remove degenerate triangles (in reverse order to maintain indices)
      degenerateTriangles.sort((a, b) => b - a);
      for (const triangleIndex of degenerateTriangles) {
        faces.splice(triangleIndex * 3, 3);
      }
    }

    // Remove isolated vertices
    const isolatedVertices = this.findIsolatedVertices(new Float32Array(vertices), new Uint32Array(faces));
    if (isolatedVertices.length > 0) {
      // Create vertex mapping (old index -> new index)
      const vertexMapping = new Map<number, number>();
      let newVertexIndex = 0;
      
      for (let i = 0; i < vertices.length / 3; i++) {
        if (!isolatedVertices.includes(i)) {
          vertexMapping.set(i, newVertexIndex++);
        }
      }

      // Remove isolated vertices
      const newVertices: number[] = [];
      for (let i = 0; i < vertices.length / 3; i++) {
        if (!isolatedVertices.includes(i)) {
          newVertices.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
        }
      }

      // Update face indices
      for (let i = 0; i < faces.length; i++) {
        const oldIndex = faces[i];
        const newIndex = vertexMapping.get(oldIndex);
        if (newIndex !== undefined) {
          faces[i] = newIndex;
        }
      }

      vertices = newVertices;
    }

    // Recalculate mesh properties
    const repairedMesh: Mesh3D = {
      vertices: new Float32Array(vertices),
      faces: new Uint32Array(faces),
      normals: new Float32Array(this.calculateNormals(vertices, faces)),
      uvs: mesh.uvs, // Keep original UVs for now
      boundingBox: this.calculateBoundingBox(vertices),
      volume: this.calculateVolume(vertices, faces),
      surfaceArea: this.calculateSurfaceArea(vertices, faces),
      isManifold: this.isManifoldGeometry(vertices, faces)
    };

    return repairedMesh;
  }

  /**
   * Optimize mesh for 3D printing by ensuring minimum wall thickness and removing thin features
   */
  optimizeForPrinting(mesh: Mesh3D, minWallThickness: number = 0.8): Mesh3D {
    // Start with a repaired mesh
    let optimizedMesh = this.repairNonManifoldGeometry(mesh);

    // Scale mesh if needed to ensure minimum wall thickness
    const currentMinThickness = this.calculateMinimumWallThickness(optimizedMesh.vertices, optimizedMesh.faces);
    if (currentMinThickness < minWallThickness && currentMinThickness > 0) {
      const scaleFactor = minWallThickness / currentMinThickness;
      optimizedMesh = this.scaleMesh(optimizedMesh, scaleFactor);
    }

    return optimizedMesh;
  }

  /**
   * Scale mesh by a uniform factor
   */
  private scaleMesh(mesh: Mesh3D, scaleFactor: number): Mesh3D {
    const scaledVertices = new Float32Array(mesh.vertices.length);
    
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      scaledVertices[i] = mesh.vertices[i] * scaleFactor;
      scaledVertices[i + 1] = mesh.vertices[i + 1] * scaleFactor;
      scaledVertices[i + 2] = mesh.vertices[i + 2] * scaleFactor;
    }

    return {
      vertices: scaledVertices,
      faces: mesh.faces,
      normals: mesh.normals, // Normals don't change with uniform scaling
      uvs: mesh.uvs,
      boundingBox: this.calculateBoundingBox(Array.from(scaledVertices)),
      volume: mesh.volume * (scaleFactor ** 3), // Volume scales with cube of scale factor
      surfaceArea: mesh.surfaceArea * (scaleFactor ** 2), // Surface area scales with square
      isManifold: mesh.isManifold
    };
  }

  /**
   * Check if two vectors are equal within tolerance
   */
  private vectorsEqual(v1: number[], v2: number[], tolerance: number = 1e-10): boolean {
    return Math.abs(v1[0] - v2[0]) < tolerance &&
           Math.abs(v1[1] - v2[1]) < tolerance &&
           Math.abs(v1[2] - v2[2]) < tolerance;
  }
}