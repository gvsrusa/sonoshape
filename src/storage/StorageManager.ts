import { Sculpture, SculptureMetadata, Mesh3D } from '../types';
import { StorageConfig, StorageQuota, StorageError, ThumbnailOptions } from './types';

export class StorageManager {
  private dbName = 'SoundWaveSculptor';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      maxSculptures: 100,
      compressionLevel: 0.8,
      thumbnailSize: 256,
      ...config
    };
  }

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        const error = new Error('Failed to open database') as StorageError;
        error.code = 'DB_ERROR';
        reject(error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create sculptures object store
        if (!db.objectStoreNames.contains('sculptures')) {
          const sculptureStore = db.createObjectStore('sculptures', { keyPath: 'metadata.id' });
          sculptureStore.createIndex('name', 'metadata.name', { unique: false });
          sculptureStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
          sculptureStore.createIndex('audioFileName', 'metadata.audioFileName', { unique: false });
        }

        // Create thumbnails object store
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Save a sculpture with metadata and generate thumbnail
   */
  async saveSculpture(sculpture: Sculpture, thumbnailCanvas?: HTMLCanvasElement): Promise<string> {
    if (!this.db) {
      await this.initialize();
    }

    // Check storage quota
    const quota = await this.getStorageQuota();
    if (quota.used >= quota.total * 0.9) { // 90% threshold
      const error = new Error('Storage quota nearly exceeded') as StorageError;
      error.code = 'QUOTA_EXCEEDED';
      throw error;
    }

    // Check sculpture count limit
    const existingSculptures = await this.getSculptureList();
    if (existingSculptures.length >= this.config.maxSculptures) {
      const error = new Error(`Maximum number of sculptures (${this.config.maxSculptures}) reached`) as StorageError;
      error.code = 'QUOTA_EXCEEDED';
      throw error;
    }

    const transaction = this.db!.transaction(['sculptures', 'thumbnails'], 'readwrite');
    const sculptureStore = transaction.objectStore('sculptures');
    const thumbnailStore = transaction.objectStore('thumbnails');

    try {
      // Save sculpture
      await new Promise<void>((resolve, reject) => {
        const request = sculptureStore.put(sculpture);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Generate and save thumbnail if canvas provided
      if (thumbnailCanvas) {
        const thumbnailBlob = await this.generateThumbnail(thumbnailCanvas);
        const thumbnailData = {
          id: sculpture.metadata.id,
          blob: thumbnailBlob,
          createdAt: new Date()
        };

        await new Promise<void>((resolve, reject) => {
          const request = thumbnailStore.put(thumbnailData);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      return sculpture.metadata.id;
    } catch (error) {
      const storageError = new Error('Failed to save sculpture') as StorageError;
      storageError.code = 'DB_ERROR';
      throw storageError;
    }
  }

  /**
   * Load a sculpture by ID
   */
  async loadSculpture(id: string): Promise<Sculpture> {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(['sculptures'], 'readonly');
    const store = transaction.objectStore('sculptures');

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          const error = new Error(`Sculpture with ID ${id} not found`) as StorageError;
          error.code = 'NOT_FOUND';
          reject(error);
        }
      };

      request.onerror = () => {
        const error = new Error('Failed to load sculpture') as StorageError;
        error.code = 'DB_ERROR';
        reject(error);
      };
    });
  }

  /**
   * Get list of all sculpture metadata
   */
  async getSculptureList(): Promise<SculptureMetadata[]> {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(['sculptures'], 'readonly');
    const store = transaction.objectStore('sculptures');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const sculptures = request.result as Sculpture[];
        const metadata = sculptures.map(sculpture => sculpture.metadata);
        // Sort by creation date, newest first
        metadata.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(metadata);
      };

      request.onerror = () => {
        const error = new Error('Failed to load sculpture list') as StorageError;
        error.code = 'DB_ERROR';
        reject(error);
      };
    });
  }

  /**
   * Get thumbnail for a sculpture
   */
  async getThumbnail(sculptureId: string): Promise<Blob | null> {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(['thumbnails'], 'readonly');
    const store = transaction.objectStore('thumbnails');

    return new Promise((resolve, reject) => {
      const request = store.get(sculptureId);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        const error = new Error('Failed to load thumbnail') as StorageError;
        error.code = 'DB_ERROR';
        reject(error);
      };
    });
  }

  /**
   * Generate thumbnail from canvas
   */
  private async generateThumbnail(canvas: HTMLCanvasElement, options?: Partial<ThumbnailOptions>): Promise<Blob> {
    const opts: ThumbnailOptions = {
      width: this.config.thumbnailSize,
      height: this.config.thumbnailSize,
      quality: this.config.compressionLevel,
      ...options
    };

    // Create a new canvas for the thumbnail
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = opts.width;
    thumbnailCanvas.height = opts.height;
    
    const ctx = thumbnailCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context for thumbnail generation');
    }

    // Draw the original canvas scaled down
    ctx.drawImage(canvas, 0, 0, opts.width, opts.height);

    return new Promise((resolve, reject) => {
      thumbnailCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate thumbnail blob'));
        }
      }, 'image/jpeg', opts.quality);
    });
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<StorageQuota> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0),
          total: estimate.quota || 0
        };
      } catch (error) {
        // Fallback for browsers that don't support storage estimation
        return {
          used: 0,
          available: Infinity,
          total: Infinity
        };
      }
    }

    // Fallback for older browsers
    return {
      used: 0,
      available: Infinity,
      total: Infinity
    };
  }

  /**
   * Delete a sculpture by ID
   */
  async deleteSculpture(id: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const transaction = this.db!.transaction(['sculptures', 'thumbnails'], 'readwrite');
    const sculptureStore = transaction.objectStore('sculptures');
    const thumbnailStore = transaction.objectStore('thumbnails');

    try {
      // Delete sculpture
      await new Promise<void>((resolve, reject) => {
        const request = sculptureStore.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Delete thumbnail if it exists
      await new Promise<void>((resolve, reject) => {
        const request = thumbnailStore.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Don't fail if thumbnail doesn't exist
      });
    } catch (error) {
      const storageError = new Error('Failed to delete sculpture') as StorageError;
      storageError.code = 'DB_ERROR';
      throw storageError;
    }
  }

  /**
   * Rename a sculpture
   */
  async renameSculpture(id: string, newName: string, newDescription?: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const sculpture = await this.loadSculpture(id);
    sculpture.metadata.name = newName;
    if (newDescription !== undefined) {
      sculpture.metadata.description = newDescription;
    }

    const transaction = this.db!.transaction(['sculptures'], 'readwrite');
    const store = transaction.objectStore('sculptures');

    try {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(sculpture);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      const storageError = new Error('Failed to rename sculpture') as StorageError;
      storageError.code = 'DB_ERROR';
      throw storageError;
    }
  }

  /**
   * Duplicate a sculpture with a new ID and name
   */
  async duplicateSculpture(id: string, newName?: string): Promise<string> {
    if (!this.db) {
      await this.initialize();
    }

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

    // Save the duplicated sculpture
    await this.saveSculpture(duplicatedSculpture);

    // Copy thumbnail if it exists
    const originalThumbnail = await this.getThumbnail(id);
    if (originalThumbnail) {
      const transaction = this.db!.transaction(['thumbnails'], 'readwrite');
      const store = transaction.objectStore('thumbnails');

      const thumbnailData = {
        id: newId,
        blob: originalThumbnail,
        createdAt: new Date()
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(thumbnailData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    return newId;
  }

  /**
   * Search sculptures by name or description
   */
  async searchSculptures(query: string): Promise<SculptureMetadata[]> {
    const allSculptures = await this.getSculptureList();
    const lowercaseQuery = query.toLowerCase();

    return allSculptures.filter(sculpture => 
      sculpture.name.toLowerCase().includes(lowercaseQuery) ||
      sculpture.description.toLowerCase().includes(lowercaseQuery) ||
      sculpture.audioFileName.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Filter sculptures by various criteria
   */
  async filterSculptures(filters: {
    stylePreset?: string;
    dateRange?: { start: Date; end: Date };
    audioFileName?: string;
  }): Promise<SculptureMetadata[]> {
    const allSculptures = await this.getSculptureList();

    return allSculptures.filter(sculpture => {
      // Filter by style preset
      if (filters.stylePreset && sculpture.parameters.stylePreset !== filters.stylePreset) {
        return false;
      }

      // Filter by date range
      if (filters.dateRange) {
        const createdAt = new Date(sculpture.createdAt);
        if (createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) {
          return false;
        }
      }

      // Filter by audio file name
      if (filters.audioFileName && !sculpture.audioFileName.toLowerCase().includes(filters.audioFileName.toLowerCase())) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    totalSculptures: number;
    totalSize: number;
    averageSize: number;
    oldestSculpture?: Date;
    newestSculpture?: Date;
    styleBreakdown: Record<string, number>;
  }> {
    const sculptures = await this.getSculptureList();
    const quota = await this.getStorageQuota();

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
      totalSize: quota.used,
      averageSize: quota.used / sculptures.length,
      oldestSculpture: new Date(Math.min(...dates.map(d => d.getTime()))),
      newestSculpture: new Date(Math.max(...dates.map(d => d.getTime()))),
      styleBreakdown
    };
  }

  /**
   * Get cleanup suggestions based on storage usage
   */
  async getCleanupSuggestions(): Promise<{
    shouldCleanup: boolean;
    suggestions: string[];
    candidatesForDeletion: SculptureMetadata[];
  }> {
    const quota = await this.getStorageQuota();
    const sculptures = await this.getSculptureList();
    const usagePercentage = quota.total > 0 ? (quota.used / quota.total) * 100 : 0;

    const suggestions: string[] = [];
    const candidatesForDeletion: SculptureMetadata[] = [];

    const shouldCleanup = usagePercentage > 80; // Suggest cleanup at 80% usage

    if (shouldCleanup) {
      suggestions.push(`Storage is ${usagePercentage.toFixed(1)}% full`);

      // Find old sculptures (older than 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const oldSculptures = sculptures.filter(s => new Date(s.createdAt) < sixMonthsAgo);
      if (oldSculptures.length > 0) {
        suggestions.push(`Consider removing ${oldSculptures.length} sculptures older than 6 months`);
        candidatesForDeletion.push(...oldSculptures);
      }

      // Find duplicate names (potential duplicates)
      const nameGroups = sculptures.reduce((groups, sculpture) => {
        const baseName = sculpture.name.replace(/ \(Copy\)$/, '');
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(sculpture);
        return groups;
      }, {} as Record<string, SculptureMetadata[]>);

      const duplicates = Object.values(nameGroups)
        .filter(group => group.length > 1)
        .flat()
        .filter(s => s.name.includes('(Copy)'));

      if (duplicates.length > 0) {
        suggestions.push(`Consider removing ${duplicates.length} duplicate sculptures`);
        candidatesForDeletion.push(...duplicates);
      }

      if (sculptures.length > this.config.maxSculptures * 0.8) {
        suggestions.push(`Approaching maximum sculpture limit (${sculptures.length}/${this.config.maxSculptures})`);
      }
    }

    return {
      shouldCleanup,
      suggestions,
      candidatesForDeletion: [...new Set(candidatesForDeletion)] // Remove duplicates
    };
  }

  /**
   * Bulk delete sculptures
   */
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

  /**
   * Export sculpture metadata as JSON
   */
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

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}