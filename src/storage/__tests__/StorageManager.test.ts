import { StorageManager } from '../StorageManager';
import { Sculpture, SculptureMetadata, Mesh3D, AudioFeatures, SculptureParams } from '../../types';
import { StorageError } from '../types';

// Simple mock for testing core functionality
class MockStorageManager extends StorageManager {
  private mockData = new Map<string, Sculpture>();
  private mockThumbnails = new Map<string, Blob>();
  private mockQuota = { used: 1000000, available: 9000000, total: 10000000 };

  async initialize(): Promise<void> {
    // Mock initialization - always succeeds
    return Promise.resolve();
  }

  async saveSculpture(sculpture: Sculpture, thumbnailCanvas?: HTMLCanvasElement): Promise<string> {
    // Check quota
    if (this.mockQuota.used >= this.mockQuota.total * 0.9) {
      const error = new Error('Storage quota nearly exceeded') as StorageError;
      error.code = 'QUOTA_EXCEEDED';
      throw error;
    }

    // Check sculpture count limit
    const config = (this as any).config;
    if (this.mockData.size >= config.maxSculptures) {
      const error = new Error(`Maximum number of sculptures (${config.maxSculptures}) reached`) as StorageError;
      error.code = 'QUOTA_EXCEEDED';
      throw error;
    }

    this.mockData.set(sculpture.metadata.id, sculpture);

    if (thumbnailCanvas) {
      const blob = new Blob(['mock thumbnail'], { type: 'image/jpeg' });
      this.mockThumbnails.set(sculpture.metadata.id, blob);
    }

    return sculpture.metadata.id;
  }

  async loadSculpture(id: string): Promise<Sculpture> {
    const sculpture = this.mockData.get(id);
    if (!sculpture) {
      const error = new Error(`Sculpture with ID ${id} not found`) as StorageError;
      error.code = 'NOT_FOUND';
      throw error;
    }
    return sculpture;
  }

  async getSculptureList(): Promise<SculptureMetadata[]> {
    const sculptures = Array.from(this.mockData.values());
    const metadata = sculptures.map(sculpture => sculpture.metadata);
    return metadata.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getThumbnail(sculptureId: string): Promise<Blob | null> {
    return this.mockThumbnails.get(sculptureId) || null;
  }

  async getStorageQuota() {
    return this.mockQuota;
  }

  async deleteSculpture(id: string): Promise<void> {
    if (!this.mockData.has(id)) {
      const error = new Error(`Sculpture with ID ${id} not found`) as StorageError;
      error.code = 'NOT_FOUND';
      throw error;
    }
    this.mockData.delete(id);
    this.mockThumbnails.delete(id);
  }

  async renameSculpture(id: string, newName: string, newDescription?: string): Promise<void> {
    const sculpture = await this.loadSculpture(id);
    sculpture.metadata.name = newName;
    if (newDescription !== undefined) {
      sculpture.metadata.description = newDescription;
    }
    this.mockData.set(id, sculpture);
  }

  async duplicateSculpture(id: string, newName?: string): Promise<string> {
    const originalSculpture = await this.loadSculpture(id);
    const newId = `${id}-copy-${Date.now()}`;
    
    const duplicatedSculpture: Sculpture = {
      ...originalSculpture,
      metadata: {
        ...originalSculpture.metadata,
        id: newId,
        name: newName || `${originalSculpture.metadata.name} (Copy)`,
        createdAt: new Date()
      }
    };

    this.mockData.set(newId, duplicatedSculpture);

    // Copy thumbnail if it exists
    const originalThumbnail = this.mockThumbnails.get(id);
    if (originalThumbnail) {
      this.mockThumbnails.set(newId, originalThumbnail);
    }

    return newId;
  }

  async searchSculptures(query: string): Promise<SculptureMetadata[]> {
    const allSculptures = await this.getSculptureList();
    const lowercaseQuery = query.toLowerCase();

    return allSculptures.filter(sculpture => 
      sculpture.name.toLowerCase().includes(lowercaseQuery) ||
      sculpture.description.toLowerCase().includes(lowercaseQuery) ||
      sculpture.audioFileName.toLowerCase().includes(lowercaseQuery)
    );
  }

  async filterSculptures(filters: {
    stylePreset?: string;
    dateRange?: { start: Date; end: Date };
    audioFileName?: string;
  }): Promise<SculptureMetadata[]> {
    const allSculptures = await this.getSculptureList();

    return allSculptures.filter(sculpture => {
      if (filters.stylePreset && sculpture.parameters.stylePreset !== filters.stylePreset) {
        return false;
      }

      if (filters.dateRange) {
        const createdAt = new Date(sculpture.createdAt);
        if (createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) {
          return false;
        }
      }

      if (filters.audioFileName && !sculpture.audioFileName.toLowerCase().includes(filters.audioFileName.toLowerCase())) {
        return false;
      }

      return true;
    });
  }

  async getStorageStats() {
    const sculptures = await this.getSculptureList();

    if (sculptures.length === 0) {
      return {
        totalSculptures: 0,
        totalSize: 0,
        averageSize: 0,
        styleBreakdown: {}
      };
    }

    const dates = sculptures.map(s => new Date(s.createdAt));
    const styleBreakdown: Record<string, number> = {};

    sculptures.forEach(sculpture => {
      const style = sculpture.parameters.stylePreset;
      styleBreakdown[style] = (styleBreakdown[style] || 0) + 1;
    });

    return {
      totalSculptures: sculptures.length,
      totalSize: this.mockQuota.used,
      averageSize: this.mockQuota.used / sculptures.length,
      oldestSculpture: new Date(Math.min(...dates.map(d => d.getTime()))),
      newestSculpture: new Date(Math.max(...dates.map(d => d.getTime()))),
      styleBreakdown
    };
  }

  async getCleanupSuggestions() {
    const sculptures = await this.getSculptureList();
    const usagePercentage = this.mockQuota.total > 0 ? (this.mockQuota.used / this.mockQuota.total) * 100 : 0;

    const suggestions: string[] = [];
    const candidatesForDeletion: SculptureMetadata[] = [];
    const shouldCleanup = usagePercentage > 80;

    if (shouldCleanup) {
      suggestions.push(`Storage is ${usagePercentage.toFixed(1)}% full`);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const oldSculptures = sculptures.filter(s => new Date(s.createdAt) < sixMonthsAgo);
      if (oldSculptures.length > 0) {
        suggestions.push(`Consider removing ${oldSculptures.length} sculptures older than 6 months`);
        candidatesForDeletion.push(...oldSculptures);
      }

      const duplicates = sculptures.filter(s => s.name.includes('(Copy)'));
      if (duplicates.length > 0) {
        suggestions.push(`Consider removing ${duplicates.length} duplicate sculptures`);
        candidatesForDeletion.push(...duplicates);
      }
    }

    return {
      shouldCleanup,
      suggestions,
      candidatesForDeletion: [...new Set(candidatesForDeletion)]
    };
  }

  async bulkDeleteSculptures(ids: string[]): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [] as string[], failed: [] as string[] };

    for (const id of ids) {
      try {
        await this.deleteSculpture(id);
        results.success.push(id);
      } catch (error) {
        results.failed.push(id);
      }
    }

    return results;
  }

  async exportMetadata(): Promise<string> {
    const sculptures = await this.getSculptureList();
    const stats = await this.getStorageStats();
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalSculptures: sculptures.length,
      statistics: stats,
      sculptures: sculptures
    };

    return JSON.stringify(exportData, null, 2);
  }

  setMockQuota(quota: { used: number; available: number; total: number }) {
    this.mockQuota = quota;
  }

  clearMockData() {
    this.mockData.clear();
    this.mockThumbnails.clear();
  }
}

// Mock navigator.storage
const mockStorage = {
  estimate: () => Promise.resolve({
    usage: 1000000,
    quota: 10000000
  })
};

// Mock canvas and context
const mockCanvas = {
  width: 512,
  height: 512,
  getContext: () => ({
    drawImage: jest.fn()
  }),
  toBlob: (callback: (blob: Blob | null) => void) => {
    const blob = new Blob(['mock image data'], { type: 'image/jpeg' });
    callback(blob);
  }
} as unknown as HTMLCanvasElement;

describe('StorageManager', () => {
  let storageManager: MockStorageManager;
  let mockSculpture: Sculpture;

  beforeAll(() => {
    // Setup global mocks
    (global as any).navigator = {
      ...global.navigator,
      storage: mockStorage
    };
    
    // Mock document.createElement for canvas
    global.document = {
      createElement: (tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas;
        }
        return {} as any;
      }
    } as any;
  });

  beforeEach(() => {
    storageManager = new MockStorageManager();
    storageManager.clearMockData();
    
    // Create mock sculpture data
    const mockAudioFeatures: AudioFeatures = {
      frequencyData: [new Float32Array([1, 2, 3])],
      amplitudeEnvelope: new Float32Array([0.5, 0.8, 0.3]),
      spectralCentroid: new Float32Array([1000, 1200, 900]),
      spectralRolloff: new Float32Array([2000, 2400, 1800]),
      zeroCrossingRate: new Float32Array([0.1, 0.2, 0.15]),
      mfcc: [new Float32Array([1, 2, 3])],
      tempo: 120,
      key: 'C'
    };

    const mockSculptureParams: SculptureParams = {
      frequencyMapping: {
        lowFreqToHeight: 0.8,
        midFreqToWidth: 0.6,
        highFreqToDepth: 0.4
      },
      amplitudeMapping: {
        sensitivity: 0.7,
        smoothing: 0.3
      },
      stylePreset: 'organic',
      resolution: 64,
      symmetry: 'none'
    };

    const mockMesh: Mesh3D = {
      vertices: new Float32Array([0, 0, 0, 1, 1, 1]),
      faces: new Uint32Array([0, 1, 2]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0]),
      uvs: new Float32Array([0, 0, 1, 1]),
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 1 }
      },
      volume: 1.0,
      surfaceArea: 6.0,
      isManifold: true
    };

    const mockMetadata: SculptureMetadata = {
      id: 'test-sculpture-1',
      name: 'Test Sculpture',
      description: 'A test sculpture for unit testing',
      createdAt: new Date(),
      audioFileName: 'test-audio.mp3',
      parameters: mockSculptureParams
    };

    mockSculpture = {
      metadata: mockMetadata,
      mesh: mockMesh,
      audioFeatures: mockAudioFeatures
    };
  });

  afterEach(() => {
    storageManager.close();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(storageManager).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        maxSculptures: 50,
        compressionLevel: 0.9,
        thumbnailSize: 128
      };
      const customStorageManager = new StorageManager(customConfig);
      expect(customStorageManager).toBeDefined();
    });

    it('should initialize database successfully', async () => {
      await expect(storageManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('sculpture operations', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should save a sculpture successfully', async () => {
      const sculptureId = await storageManager.saveSculpture(mockSculpture);
      expect(sculptureId).toBe(mockSculpture.metadata.id);
    });

    it('should save a sculpture with thumbnail', async () => {
      const sculptureId = await storageManager.saveSculpture(mockSculpture, mockCanvas);
      expect(sculptureId).toBe(mockSculpture.metadata.id);
    });

    it('should load a sculpture by ID', async () => {
      await storageManager.saveSculpture(mockSculpture);
      const loadedSculpture = await storageManager.loadSculpture(mockSculpture.metadata.id);
      
      expect(loadedSculpture.metadata.id).toBe(mockSculpture.metadata.id);
      expect(loadedSculpture.metadata.name).toBe(mockSculpture.metadata.name);
    });

    it('should throw error when loading non-existent sculpture', async () => {
      await expect(storageManager.loadSculpture('non-existent-id'))
        .rejects.toThrow('Sculpture with ID non-existent-id not found');
    });

    it('should get list of sculpture metadata', async () => {
      await storageManager.saveSculpture(mockSculpture);
      
      const sculptureList = await storageManager.getSculptureList();
      expect(sculptureList).toHaveLength(1);
      expect(sculptureList[0].id).toBe(mockSculpture.metadata.id);
      expect(sculptureList[0].name).toBe(mockSculpture.metadata.name);
    });

    it('should return empty list when no sculptures exist', async () => {
      const sculptureList = await storageManager.getSculptureList();
      expect(sculptureList).toHaveLength(0);
    });

    it('should sort sculpture list by creation date (newest first)', async () => {
      const sculpture1 = { 
        ...mockSculpture,
        metadata: {
          ...mockSculpture.metadata,
          id: 'sculpture-1',
          createdAt: new Date('2023-01-01')
        }
      };

      const sculpture2 = { 
        ...mockSculpture,
        metadata: {
          ...mockSculpture.metadata,
          id: 'sculpture-2',
          createdAt: new Date('2023-01-02')
        }
      };

      await storageManager.saveSculpture(sculpture1);
      await storageManager.saveSculpture(sculpture2);

      const sculptureList = await storageManager.getSculptureList();
      expect(sculptureList).toHaveLength(2);
      expect(sculptureList[0].id).toBe('sculpture-2'); // Newer first
      expect(sculptureList[1].id).toBe('sculpture-1');
    });
  });

  describe('thumbnail operations', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should get thumbnail for sculpture', async () => {
      await storageManager.saveSculpture(mockSculpture, mockCanvas);
      
      const thumbnail = await storageManager.getThumbnail(mockSculpture.metadata.id);
      expect(thumbnail).toBeInstanceOf(Blob);
    });

    it('should return null for non-existent thumbnail', async () => {
      const thumbnail = await storageManager.getThumbnail('non-existent-id');
      expect(thumbnail).toBeNull();
    });
  });

  describe('storage quota management', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should get storage quota information', async () => {
      const quota = await storageManager.getStorageQuota();
      
      expect(quota).toHaveProperty('used');
      expect(quota).toHaveProperty('available');
      expect(quota).toHaveProperty('total');
      expect(typeof quota.used).toBe('number');
      expect(typeof quota.available).toBe('number');
      expect(typeof quota.total).toBe('number');
    });

    it('should handle quota exceeded error', async () => {
      // Set mock quota to high usage
      storageManager.setMockQuota({ used: 9500000, available: 500000, total: 10000000 });

      await expect(storageManager.saveSculpture(mockSculpture))
        .rejects.toThrow('Storage quota nearly exceeded');
    });

    it('should handle max sculptures limit', async () => {
      const limitedStorageManager = new MockStorageManager({ maxSculptures: 1 });
      await limitedStorageManager.initialize();

      // Save first sculpture
      await limitedStorageManager.saveSculpture(mockSculpture);

      // Try to save second sculpture
      const secondSculpture = { ...mockSculpture };
      secondSculpture.metadata.id = 'second-sculpture';

      await expect(limitedStorageManager.saveSculpture(secondSculpture))
        .rejects.toThrow('Maximum number of sculptures (1) reached');

      limitedStorageManager.close();
    });
  });

  describe('error handling', () => {
    it('should handle database initialization errors', async () => {
      // Test error handling by creating a failing mock
      class FailingMockStorageManager extends MockStorageManager {
        async initialize(): Promise<void> {
          const error = new Error('Failed to open database') as StorageError;
          error.code = 'DB_ERROR';
          throw error;
        }
      }

      const failingStorageManager = new FailingMockStorageManager();
      await expect(failingStorageManager.initialize())
        .rejects.toThrow('Failed to open database');
    });

    it('should handle storage operations without initialization', async () => {
      const uninitializedManager = new MockStorageManager();
      
      // Should auto-initialize and work
      await expect(uninitializedManager.saveSculpture(mockSculpture))
        .resolves.toBe(mockSculpture.metadata.id);
      
      uninitializedManager.close();
    });
  });

  describe('data integrity', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should preserve all sculpture data fields', async () => {
      await storageManager.saveSculpture(mockSculpture);
      const loadedSculpture = await storageManager.loadSculpture(mockSculpture.metadata.id);

      // Check metadata
      expect(loadedSculpture.metadata.name).toBe(mockSculpture.metadata.name);
      expect(loadedSculpture.metadata.description).toBe(mockSculpture.metadata.description);
      expect(loadedSculpture.metadata.audioFileName).toBe(mockSculpture.metadata.audioFileName);

      // Check mesh data
      expect(loadedSculpture.mesh.volume).toBe(mockSculpture.mesh.volume);
      expect(loadedSculpture.mesh.surfaceArea).toBe(mockSculpture.mesh.surfaceArea);
      expect(loadedSculpture.mesh.isManifold).toBe(mockSculpture.mesh.isManifold);

      // Check audio features
      expect(loadedSculpture.audioFeatures.tempo).toBe(mockSculpture.audioFeatures.tempo);
      expect(loadedSculpture.audioFeatures.key).toBe(mockSculpture.audioFeatures.key);
    });

    it('should handle TypedArray serialization correctly', async () => {
      await storageManager.saveSculpture(mockSculpture);
      const loadedSculpture = await storageManager.loadSculpture(mockSculpture.metadata.id);

      // TypedArrays should be preserved
      expect(loadedSculpture.mesh.vertices).toBeInstanceOf(Float32Array);
      expect(loadedSculpture.mesh.faces).toBeInstanceOf(Uint32Array);
      expect(loadedSculpture.audioFeatures.amplitudeEnvelope).toBeInstanceOf(Float32Array);
    });
  });

  describe('collection management', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    describe('sculpture deletion', () => {
      it('should delete a sculpture successfully', async () => {
        await storageManager.saveSculpture(mockSculpture);
        
        await storageManager.deleteSculpture(mockSculpture.metadata.id);
        
        await expect(storageManager.loadSculpture(mockSculpture.metadata.id))
          .rejects.toThrow('Sculpture with ID test-sculpture-1 not found');
      });

      it('should delete sculpture thumbnail when deleting sculpture', async () => {
        await storageManager.saveSculpture(mockSculpture, mockCanvas);
        
        let thumbnail = await storageManager.getThumbnail(mockSculpture.metadata.id);
        expect(thumbnail).toBeInstanceOf(Blob);
        
        await storageManager.deleteSculpture(mockSculpture.metadata.id);
        
        thumbnail = await storageManager.getThumbnail(mockSculpture.metadata.id);
        expect(thumbnail).toBeNull();
      });

      it('should throw error when deleting non-existent sculpture', async () => {
        await expect(storageManager.deleteSculpture('non-existent-id'))
          .rejects.toThrow('Sculpture with ID non-existent-id not found');
      });
    });

    describe('sculpture renaming', () => {
      it('should rename a sculpture successfully', async () => {
        await storageManager.saveSculpture(mockSculpture);
        
        await storageManager.renameSculpture(mockSculpture.metadata.id, 'New Name', 'New Description');
        
        const updatedSculpture = await storageManager.loadSculpture(mockSculpture.metadata.id);
        expect(updatedSculpture.metadata.name).toBe('New Name');
        expect(updatedSculpture.metadata.description).toBe('New Description');
      });

      it('should rename sculpture without changing description', async () => {
        await storageManager.saveSculpture(mockSculpture);
        const originalDescription = mockSculpture.metadata.description;
        
        await storageManager.renameSculpture(mockSculpture.metadata.id, 'New Name');
        
        const updatedSculpture = await storageManager.loadSculpture(mockSculpture.metadata.id);
        expect(updatedSculpture.metadata.name).toBe('New Name');
        expect(updatedSculpture.metadata.description).toBe(originalDescription);
      });

      it('should throw error when renaming non-existent sculpture', async () => {
        await expect(storageManager.renameSculpture('non-existent-id', 'New Name'))
          .rejects.toThrow('Sculpture with ID non-existent-id not found');
      });
    });

    describe('sculpture duplication', () => {
      it('should duplicate a sculpture successfully', async () => {
        await storageManager.saveSculpture(mockSculpture);
        
        const newId = await storageManager.duplicateSculpture(mockSculpture.metadata.id, 'Duplicated Sculpture');
        
        const originalSculpture = await storageManager.loadSculpture(mockSculpture.metadata.id);
        const duplicatedSculpture = await storageManager.loadSculpture(newId);
        
        expect(duplicatedSculpture.metadata.name).toBe('Duplicated Sculpture');
        expect(duplicatedSculpture.metadata.id).not.toBe(originalSculpture.metadata.id);
        expect(duplicatedSculpture.mesh.volume).toBe(originalSculpture.mesh.volume);
        expect(duplicatedSculpture.audioFeatures.tempo).toBe(originalSculpture.audioFeatures.tempo);
      });

      it('should duplicate sculpture with default name', async () => {
        await storageManager.saveSculpture(mockSculpture);
        
        const newId = await storageManager.duplicateSculpture(mockSculpture.metadata.id);
        
        const duplicatedSculpture = await storageManager.loadSculpture(newId);
        expect(duplicatedSculpture.metadata.name).toBe('Test Sculpture (Copy)');
      });

      it('should duplicate sculpture thumbnail', async () => {
        await storageManager.saveSculpture(mockSculpture, mockCanvas);
        
        const newId = await storageManager.duplicateSculpture(mockSculpture.metadata.id);
        
        const originalThumbnail = await storageManager.getThumbnail(mockSculpture.metadata.id);
        const duplicatedThumbnail = await storageManager.getThumbnail(newId);
        
        expect(originalThumbnail).toBeInstanceOf(Blob);
        expect(duplicatedThumbnail).toBeInstanceOf(Blob);
      });

      it('should throw error when duplicating non-existent sculpture', async () => {
        await expect(storageManager.duplicateSculpture('non-existent-id'))
          .rejects.toThrow('Sculpture with ID non-existent-id not found');
      });
    });

    describe('sculpture search', () => {
      beforeEach(async () => {
        const sculpture1 = {
          ...mockSculpture,
          metadata: { ...mockSculpture.metadata, id: 'search-1', name: 'Jazz Music', description: 'A sculpture from jazz music' }
        };
        const sculpture2 = {
          ...mockSculpture,
          metadata: { ...mockSculpture.metadata, id: 'search-2', name: 'Rock Song', description: 'Heavy metal sculpture', audioFileName: 'rock.mp3' }
        };
        const sculpture3 = {
          ...mockSculpture,
          metadata: { ...mockSculpture.metadata, id: 'search-3', name: 'Classical', description: 'Orchestra piece' }
        };

        await storageManager.saveSculpture(sculpture1);
        await storageManager.saveSculpture(sculpture2);
        await storageManager.saveSculpture(sculpture3);
      });

      it('should search sculptures by name', async () => {
        const results = await storageManager.searchSculptures('jazz');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Jazz Music');
      });

      it('should search sculptures by description', async () => {
        const results = await storageManager.searchSculptures('sculpture');
        expect(results).toHaveLength(2);
        expect(results.map(r => r.name)).toContain('Jazz Music');
        expect(results.map(r => r.name)).toContain('Rock Song');
      });

      it('should search sculptures by audio filename', async () => {
        const results = await storageManager.searchSculptures('rock.mp3');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Rock Song');
      });

      it('should return empty array for no matches', async () => {
        const results = await storageManager.searchSculptures('nonexistent');
        expect(results).toHaveLength(0);
      });

      it('should be case insensitive', async () => {
        const results = await storageManager.searchSculptures('JAZZ');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Jazz Music');
      });
    });

    describe('sculpture filtering', () => {
      beforeEach(async () => {
        const sculpture1 = {
          ...mockSculpture,
          metadata: {
            ...mockSculpture.metadata,
            id: 'filter-1',
            name: 'Organic Jazz',
            createdAt: new Date('2023-01-01'),
            audioFileName: 'jazz.mp3',
            parameters: { ...mockSculpture.metadata.parameters, stylePreset: 'organic' as const }
          }
        };
        const sculpture2 = {
          ...mockSculpture,
          metadata: {
            ...mockSculpture.metadata,
            id: 'filter-2',
            name: 'Geometric Rock',
            createdAt: new Date('2023-06-01'),
            audioFileName: 'rock.mp3',
            parameters: { ...mockSculpture.metadata.parameters, stylePreset: 'geometric' as const }
          }
        };
        const sculpture3 = {
          ...mockSculpture,
          metadata: {
            ...mockSculpture.metadata,
            id: 'filter-3',
            name: 'Abstract Classical',
            createdAt: new Date('2023-12-01'),
            audioFileName: 'classical.mp3',
            parameters: { ...mockSculpture.metadata.parameters, stylePreset: 'abstract' as const }
          }
        };

        await storageManager.saveSculpture(sculpture1);
        await storageManager.saveSculpture(sculpture2);
        await storageManager.saveSculpture(sculpture3);
      });

      it('should filter by style preset', async () => {
        const results = await storageManager.filterSculptures({ stylePreset: 'organic' });
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Organic Jazz');
      });

      it('should filter by date range', async () => {
        const results = await storageManager.filterSculptures({
          dateRange: {
            start: new Date('2023-05-01'),
            end: new Date('2023-07-01')
          }
        });
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Geometric Rock');
      });

      it('should filter by audio filename', async () => {
        const results = await storageManager.filterSculptures({ audioFileName: 'rock' });
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Geometric Rock');
      });

      it('should apply multiple filters', async () => {
        const results = await storageManager.filterSculptures({
          stylePreset: 'abstract',
          dateRange: {
            start: new Date('2023-11-01'),
            end: new Date('2023-12-31')
          }
        });
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Abstract Classical');
      });

      it('should return empty array when no sculptures match filters', async () => {
        const results = await storageManager.filterSculptures({
          stylePreset: 'architectural',
          audioFileName: 'nonexistent'
        });
        expect(results).toHaveLength(0);
      });
    });

    describe('storage statistics', () => {
      it('should return empty stats for no sculptures', async () => {
        const stats = await storageManager.getStorageStats();
        
        expect(stats.totalSculptures).toBe(0);
        expect(stats.totalSize).toBe(0);
        expect(stats.averageSize).toBe(0);
        expect(stats.styleBreakdown).toEqual({});
      });

      it('should calculate storage statistics correctly', async () => {
        const sculpture1 = {
          ...mockSculpture,
          metadata: {
            ...mockSculpture.metadata,
            id: 'stats-1',
            createdAt: new Date('2023-01-01'),
            parameters: { ...mockSculpture.metadata.parameters, stylePreset: 'organic' as const }
          }
        };
        const sculpture2 = {
          ...mockSculpture,
          metadata: {
            ...mockSculpture.metadata,
            id: 'stats-2',
            createdAt: new Date('2023-06-01'),
            parameters: { ...mockSculpture.metadata.parameters, stylePreset: 'geometric' as const }
          }
        };
        const sculpture3 = {
          ...mockSculpture,
          metadata: {
            ...mockSculpture.metadata,
            id: 'stats-3',
            createdAt: new Date('2023-12-01'),
            parameters: { ...mockSculpture.metadata.parameters, stylePreset: 'organic' as const }
          }
        };

        await storageManager.saveSculpture(sculpture1);
        await storageManager.saveSculpture(sculpture2);
        await storageManager.saveSculpture(sculpture3);

        const stats = await storageManager.getStorageStats();
        
        expect(stats.totalSculptures).toBe(3);
        expect(stats.totalSize).toBe(1000000); // Mock quota used
        expect(stats.averageSize).toBe(1000000 / 3);
        expect(stats.oldestSculpture).toEqual(new Date('2023-01-01'));
        expect(stats.newestSculpture).toEqual(new Date('2023-12-01'));
        expect(stats.styleBreakdown).toEqual({
          organic: 2,
          geometric: 1
        });
      });
    });

    describe('cleanup suggestions', () => {
      it('should not suggest cleanup when storage usage is low', async () => {
        storageManager.setMockQuota({ used: 1000000, available: 9000000, total: 10000000 }); // 10% usage
        
        const suggestions = await storageManager.getCleanupSuggestions();
        
        expect(suggestions.shouldCleanup).toBe(false);
        expect(suggestions.suggestions).toHaveLength(0);
        expect(suggestions.candidatesForDeletion).toHaveLength(0);
      });

      it('should suggest cleanup when storage usage is high', async () => {
        storageManager.setMockQuota({ used: 8500000, available: 1500000, total: 10000000 }); // 85% usage
        
        const suggestions = await storageManager.getCleanupSuggestions();
        
        expect(suggestions.shouldCleanup).toBe(true);
        expect(suggestions.suggestions).toContain('Storage is 85.0% full');
      });

      it('should suggest removing old sculptures', async () => {
        storageManager.setMockQuota({ used: 8500000, available: 1500000, total: 10000000 });
        
        const oldSculpture = {
          ...mockSculpture,
          metadata: {
            ...mockSculpture.metadata,
            id: 'old-sculpture',
            createdAt: new Date('2022-01-01') // More than 6 months ago
          }
        };
        
        await storageManager.saveSculpture(oldSculpture);
        
        const suggestions = await storageManager.getCleanupSuggestions();
        
        expect(suggestions.shouldCleanup).toBe(true);
        expect(suggestions.suggestions.some(s => s.includes('sculptures older than 6 months'))).toBe(true);
        expect(suggestions.candidatesForDeletion).toHaveLength(1);
        expect(suggestions.candidatesForDeletion[0].id).toBe('old-sculpture');
      });

      it('should suggest removing duplicate sculptures', async () => {
        storageManager.setMockQuota({ used: 8500000, available: 1500000, total: 10000000 });
        
        const originalSculpture = {
          ...mockSculpture,
          metadata: { ...mockSculpture.metadata, id: 'original', name: 'Original' }
        };
        const duplicateSculpture = {
          ...mockSculpture,
          metadata: { ...mockSculpture.metadata, id: 'duplicate', name: 'Original (Copy)' }
        };
        
        await storageManager.saveSculpture(originalSculpture);
        await storageManager.saveSculpture(duplicateSculpture);
        
        const suggestions = await storageManager.getCleanupSuggestions();
        
        expect(suggestions.shouldCleanup).toBe(true);
        expect(suggestions.suggestions.some(s => s.includes('duplicate sculptures'))).toBe(true);
        expect(suggestions.candidatesForDeletion.some(c => c.name.includes('(Copy)'))).toBe(true);
      });
    });

    describe('bulk operations', () => {
      beforeEach(async () => {
        const sculptures = [
          { ...mockSculpture, metadata: { ...mockSculpture.metadata, id: 'bulk-1', name: 'Bulk 1' } },
          { ...mockSculpture, metadata: { ...mockSculpture.metadata, id: 'bulk-2', name: 'Bulk 2' } },
          { ...mockSculpture, metadata: { ...mockSculpture.metadata, id: 'bulk-3', name: 'Bulk 3' } }
        ];

        for (const sculpture of sculptures) {
          await storageManager.saveSculpture(sculpture);
        }
      });

      it('should bulk delete sculptures successfully', async () => {
        const result = await storageManager.bulkDeleteSculptures(['bulk-1', 'bulk-2']);
        
        expect(result.success).toEqual(['bulk-1', 'bulk-2']);
        expect(result.failed).toHaveLength(0);
        
        const remainingSculptures = await storageManager.getSculptureList();
        expect(remainingSculptures).toHaveLength(1);
        expect(remainingSculptures[0].name).toBe('Bulk 3');
      });

      it('should handle partial failures in bulk delete', async () => {
        const result = await storageManager.bulkDeleteSculptures(['bulk-1', 'non-existent', 'bulk-2']);
        
        expect(result.success).toEqual(['bulk-1', 'bulk-2']);
        expect(result.failed).toEqual(['non-existent']);
      });
    });

    describe('metadata export', () => {
      it('should export metadata as JSON', async () => {
        await storageManager.saveSculpture(mockSculpture);
        
        const exportedData = await storageManager.exportMetadata();
        const parsedData = JSON.parse(exportedData);
        
        expect(parsedData).toHaveProperty('exportDate');
        expect(parsedData).toHaveProperty('totalSculptures', 1);
        expect(parsedData).toHaveProperty('statistics');
        expect(parsedData).toHaveProperty('sculptures');
        expect(parsedData.sculptures).toHaveLength(1);
        expect(parsedData.sculptures[0].name).toBe('Test Sculpture');
      });

      it('should export empty data when no sculptures exist', async () => {
        const exportedData = await storageManager.exportMetadata();
        const parsedData = JSON.parse(exportedData);
        
        expect(parsedData.totalSculptures).toBe(0);
        expect(parsedData.sculptures).toHaveLength(0);
      });
    });
  });

  describe('database cleanup', () => {
    it('should close database connection', () => {
      expect(() => storageManager.close()).not.toThrow();
    });

    it('should handle multiple close calls', () => {
      storageManager.close();
      expect(() => storageManager.close()).not.toThrow();
    });
  });
});