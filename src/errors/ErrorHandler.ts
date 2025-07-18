import { 
  SoundWaveSculptorError, 
  ErrorCategory, 
  ErrorSeverity, 
  ErrorContext, 
  RecoveryAction,
  TroubleshootingStep,
  AudioFormatError,
  MemoryLimitationError,
  BrowserCompatibilityError
} from './ErrorTypes';

export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableTelemetry: boolean;
  maxRetries: number;
  retryDelay: number;
  autoRecovery: boolean;
}

export interface ErrorReport {
  error: SoundWaveSculptorError;
  resolved: boolean;
  recoveryActionTaken?: string;
  resolutionTime?: number;
}

export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorHistory: ErrorReport[] = [];
  private onErrorCallback?: (error: SoundWaveSculptorError) => void;
  private onRecoveryCallback?: (error: SoundWaveSculptorError, action: RecoveryAction) => void;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableLogging: true,
      enableTelemetry: false,
      maxRetries: 3,
      retryDelay: 1000,
      autoRecovery: true,
      ...config
    };
  }

  /**
   * Set callback for error notifications
   */
  onError(callback: (error: SoundWaveSculptorError) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Set callback for recovery notifications
   */
  onRecovery(callback: (error: SoundWaveSculptorError, action: RecoveryAction) => void): void {
    this.onRecoveryCallback = callback;
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  async handleError(error: Error | SoundWaveSculptorError): Promise<void> {
    const sculptorError = this.normalizeError(error);
    
    // Log error
    if (this.config.enableLogging) {
      this.logError(sculptorError);
    }

    // Add to history
    const errorReport: ErrorReport = {
      error: sculptorError,
      resolved: false
    };
    this.errorHistory.push(errorReport);

    // Notify error callback
    if (this.onErrorCallback) {
      this.onErrorCallback(sculptorError);
    }

    // Attempt automatic recovery
    if (this.config.autoRecovery) {
      const recovered = await this.attemptRecovery(sculptorError, errorReport);
      if (!recovered && sculptorError.severity === ErrorSeverity.CRITICAL) {
        // For critical errors that can't be recovered, we might need to reload
        this.handleCriticalError(sculptorError);
      }
    }
  }

  /**
   * Create context-aware audio format error
   */
  createAudioFormatError(
    originalError: Error,
    fileName: string,
    fileType: string,
    supportedFormats: string[]
  ): AudioFormatError {
    const context = this.createErrorContext({ fileName, fileType });
    const message = `Unsupported audio format "${fileType}". Please use one of: ${supportedFormats.join(', ')}`;
    
    return new AudioFormatError(message, supportedFormats, context, originalError);
  }

  /**
   * Create memory limitation error with current usage info
   */
  createMemoryLimitationError(
    operation: string,
    currentUsage: number,
    limit: number
  ): MemoryLimitationError {
    const context = this.createErrorContext({ operation });
    const message = `Memory limit exceeded during ${operation}. Using ${Math.round(currentUsage / 1024 / 1024)}MB of ${Math.round(limit / 1024 / 1024)}MB available.`;
    
    return new MemoryLimitationError(message, currentUsage, limit, context);
  }

  /**
   * Create browser compatibility error
   */
  createBrowserCompatibilityError(
    feature: string,
    fallbackAvailable: boolean = false
  ): BrowserCompatibilityError {
    const context = this.createErrorContext({ feature });
    const message = `Your browser doesn't support ${feature}. ${fallbackAvailable ? 'Using fallback implementation.' : 'Please update your browser or try a different one.'}`;
    
    return new BrowserCompatibilityError(message, feature, context, fallbackAvailable);
  }

  /**
   * Create generic error with proper categorization
   */
  createError(
    category: ErrorCategory,
    severity: ErrorSeverity,
    code: string,
    message: string,
    recoveryActions: RecoveryAction[] = [],
    troubleshootingSteps: TroubleshootingStep[] = [],
    metadata?: Record<string, any>
  ): SoundWaveSculptorError {
    const context = this.createErrorContext(metadata);
    
    return new SoundWaveSculptorError({
      category,
      severity,
      code,
      message,
      context,
      recoveryActions,
      troubleshootingSteps,
      metadata
    });
  }

  /**
   * Get error statistics and patterns
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recoveryRate: number;
    commonErrors: Array<{ code: string; count: number; message: string }>;
  } {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoveryRate: 0,
      commonErrors: [] as Array<{ code: string; count: number; message: string }>
    };

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      stats.errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      stats.errorsBySeverity[severity] = 0;
    });

    // Count errors
    const errorCounts = new Map<string, { count: number; message: string }>();
    let resolvedCount = 0;

    this.errorHistory.forEach(report => {
      const error = report.error;
      
      // Count by category and severity
      stats.errorsByCategory[error.category]++;
      stats.errorsBySeverity[error.severity]++;
      
      // Count resolved errors
      if (report.resolved) {
        resolvedCount++;
      }
      
      // Count common errors
      const existing = errorCounts.get(error.code);
      if (existing) {
        existing.count++;
      } else {
        errorCounts.set(error.code, { count: 1, message: error.message });
      }
    });

    // Calculate recovery rate
    stats.recoveryRate = this.errorHistory.length > 0 ? resolvedCount / this.errorHistory.length : 0;

    // Get most common errors
    stats.commonErrors = Array.from(errorCounts.entries())
      .map(([code, data]) => ({ code, count: data.count, message: data.message }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): ErrorReport[] {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Check if browser supports required features
   */
  checkBrowserCompatibility(): {
    isSupported: boolean;
    missingFeatures: string[];
    warnings: string[];
  } {
    const missingFeatures: string[] = [];
    const warnings: string[] = [];

    // Check Web Audio API
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      missingFeatures.push('Web Audio API');
    }

    // Check MediaDevices API for microphone access
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      missingFeatures.push('MediaDevices API (microphone access)');
    }

    // Check WebGL for 3D visualization
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      missingFeatures.push('WebGL');
    }

    // Check IndexedDB for storage
    if (!window.indexedDB) {
      missingFeatures.push('IndexedDB');
    }

    // Check File API
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
      missingFeatures.push('File API');
    }

    // Check for performance warnings
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mobile') || userAgent.includes('tablet')) {
      warnings.push('Mobile devices may have limited performance for complex audio processing');
    }

    // Check memory (if available)
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
        warnings.push('High memory usage detected - consider closing other tabs');
      }
    }

    return {
      isSupported: missingFeatures.length === 0,
      missingFeatures,
      warnings
    };
  }

  /**
   * Estimate memory usage for operation
   */
  estimateMemoryUsage(audioBuffer: AudioBuffer, meshResolution: number): {
    estimated: number;
    available: number;
    safe: boolean;
  } {
    // Estimate memory usage
    const audioSize = audioBuffer.length * audioBuffer.numberOfChannels * 4; // 4 bytes per float
    const fftSize = 2048;
    const hopSize = 512;
    const numFrames = Math.floor(audioBuffer.length / hopSize);
    const frequencyDataSize = numFrames * fftSize * 4;
    
    const meshVertices = meshResolution * meshResolution * 3 * 4; // 3 floats per vertex
    const meshFaces = meshResolution * meshResolution * 2 * 3 * 4; // 2 triangles per quad, 3 indices per triangle
    const meshNormals = meshVertices; // Same size as vertices
    
    const estimated = audioSize + frequencyDataSize + meshVertices + meshFaces + meshNormals;
    
    // Get available memory (rough estimate)
    let available = 100 * 1024 * 1024; // Default 100MB
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      available = memory.jsHeapSizeLimit - memory.usedJSHeapSize;
    }
    
    return {
      estimated,
      available,
      safe: estimated < available * 0.7 // Use only 70% of available memory
    };
  }

  /**
   * Normalize any error to SoundWaveSculptorError
   */
  private normalizeError(error: Error | SoundWaveSculptorError): SoundWaveSculptorError {
    if (error instanceof SoundWaveSculptorError) {
      return error;
    }

    // Try to categorize common errors
    const context = this.createErrorContext();
    
    if (error.name === 'EncodingError' || error.message.includes('decode')) {
      return new AudioFormatError(
        'Failed to decode audio file. The file may be corrupted or in an unsupported format.',
        ['MP3', 'WAV', 'FLAC', 'M4A'],
        context,
        error
      );
    }

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return this.createError(
        ErrorCategory.PERMISSION_ERROR,
        ErrorSeverity.HIGH,
        'PERMISSION_DENIED',
        'Permission denied. Please allow the requested permissions and try again.',
        [
          {
            type: 'manual',
            label: 'Grant Permission',
            description: 'Click the permission prompt and allow access',
            action: () => {}
          },
          {
            type: 'retry',
            label: 'Try Again',
            description: 'Retry the operation after granting permission',
            action: () => {}
          }
        ],
        [
          {
            title: 'Check Browser Permissions',
            description: 'Look for permission prompts in the address bar'
          },
          {
            title: 'Reset Site Permissions',
            description: 'Clear site permissions in browser settings and try again'
          }
        ],
        { originalError: error.message }
      );
    }

    // Generic error fallback
    return this.createError(
      ErrorCategory.AUDIO_PROCESSING,
      ErrorSeverity.MEDIUM,
      'UNKNOWN_ERROR',
      error.message || 'An unknown error occurred',
      [
        {
          type: 'retry',
          label: 'Try Again',
          description: 'Retry the operation',
          action: () => {}
        }
      ],
      [
        {
          title: 'Refresh Page',
          description: 'Try refreshing the page and attempting the operation again'
        },
        {
          title: 'Check Console',
          description: 'Open browser developer tools to see detailed error information'
        }
      ],
      { originalError: error.message, stack: error.stack }
    );
  }

  /**
   * Create error context with current environment info
   */
  private createErrorContext(additionalData?: Record<string, any>): ErrorContext {
    return {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      additionalData
    };
  }

  /**
   * Attempt automatic recovery for an error
   */
  private async attemptRecovery(error: SoundWaveSculptorError, report: ErrorReport): Promise<boolean> {
    const autoRecoveryActions = error.recoveryActions.filter(action => action.autoExecute);
    
    for (const action of autoRecoveryActions) {
      try {
        await action.action();
        report.resolved = true;
        report.recoveryActionTaken = action.type;
        report.resolutionTime = Date.now() - error.context.timestamp;
        
        if (this.onRecoveryCallback) {
          this.onRecoveryCallback(error, action);
        }
        
        return true;
      } catch (recoveryError) {
        // Recovery failed, continue to next action
        if (this.config.enableLogging) {
          console.warn('Recovery action failed:', action.type, recoveryError);
        }
      }
    }
    
    return false;
  }

  /**
   * Handle critical errors that require page reload or user intervention
   */
  private handleCriticalError(error: SoundWaveSculptorError): void {
    if (this.config.enableLogging) {
      console.error('Critical error encountered:', error);
    }

    // For critical errors, we might want to show a modal or reload the page
    // This would be implemented based on the UI framework being used
    if (confirm('A critical error occurred. Would you like to reload the page?')) {
      window.location.reload();
    }
  }

  /**
   * Log error to console with structured format
   */
  private logError(error: SoundWaveSculptorError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logData = {
      category: error.category,
      severity: error.severity,
      code: error.code,
      message: error.message,
      context: error.context,
      metadata: error.metadata
    };

    console[logLevel](`[${error.category}] ${error.code}: ${error.message}`, logData);
  }

  /**
   * Get appropriate console log level for error severity
   */
  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'log';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'log';
    }
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

// Set up global error handling
window.addEventListener('error', (event) => {
  globalErrorHandler.handleError(event.error || new Error(event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  globalErrorHandler.handleError(event.reason || new Error('Unhandled promise rejection'));
});