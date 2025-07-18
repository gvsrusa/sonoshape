// Storage specific types
export interface StorageConfig {
  maxSculptures: number;
  compressionLevel: number;
  thumbnailSize: number;
}

export interface StorageQuota {
  used: number;
  available: number;
  total: number;
}

export interface StorageError extends Error {
  code: 'QUOTA_EXCEEDED' | 'NOT_FOUND' | 'INVALID_DATA' | 'DB_ERROR';
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality: number;
}