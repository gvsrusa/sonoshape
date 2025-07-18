/**
 * Error types and interfaces for comprehensive error handling
 */

export enum ErrorCategory {
  AUDIO_FORMAT = 'audio-format',
  AUDIO_PROCESSING = 'audio-processing',
  MEMORY_LIMITATION = 'memory-limitation',
  BROWSER_COMPATIBILITY = 'browser-compatibility',
  MESH_GENERATION = 'mesh-generation',
  EXPORT_ERROR = 'export-error',
  STORAGE_ERROR = 'storage-error',
  NETWORK_ERROR = 'network-error',
  PERMISSION_ERROR = 'permission-error',
  VALIDATION_ERROR = 'validation-error'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  timestamp: number;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'redirect' | 'manual' | 'ignore';
  label: string;
  description: string;
  action: () => Promise<void> | void;
  autoExecute?: boolean;
}

export interface TroubleshootingStep {
  title: string;
  description: string;
  action?: string;
  link?: string;
}

export interface ErrorDetails {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  technicalMessage?: string;
  context: ErrorContext;
  recoveryActions: RecoveryAction[];
  troubleshootingSteps: TroubleshootingStep[];
  relatedErrors?: string[];
  metadata?: Record<string, any>;
}

export class SoundWaveSculptorError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly context: ErrorContext;
  public readonly recoveryActions: RecoveryAction[];
  public readonly troubleshootingSteps: TroubleshootingStep[];
  public readonly technicalMessage?: string;
  public readonly metadata?: Record<string, any>;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'SoundWaveSculptorError';
    this.category = details.category;
    this.severity = details.severity;
    this.code = details.code;
    this.context = details.context;
    this.recoveryActions = details.recoveryActions;
    this.troubleshootingSteps = details.troubleshootingSteps;
    this.technicalMessage = details.technicalMessage;
    this.metadata = details.metadata;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SoundWaveSculptorError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      code: this.code,
      context: this.context,
      recoveryActions: this.recoveryActions.map(action => ({
        type: action.type,
        label: action.label,
        description: action.description,
        autoExecute: action.autoExecute
      })),
      troubleshootingSteps: this.troubleshootingSteps,
      technicalMessage: this.technicalMessage,
      metadata: this.metadata,
      stack: this.stack
    };
  }
}

// Specific error types
export class AudioFormatError extends SoundWaveSculptorError {
  constructor(message: string, supportedFormats: string[], context: ErrorContext, originalError?: Error) {
    super({
      category: ErrorCategory.AUDIO_FORMAT,
      severity: ErrorSeverity.MEDIUM,
      code: 'AUDIO_FORMAT_UNSUPPORTED',
      message,
      technicalMessage: originalError?.message,
      context,
      recoveryActions: [
        {
          type: 'manual',
          label: 'Convert Audio File',
          description: `Convert your audio file to one of the supported formats: ${supportedFormats.join(', ')}`,
          action: () => {}
        },
        {
          type: 'retry',
          label: 'Try Another File',
          description: 'Select a different audio file in a supported format',
          action: () => {}
        }
      ],
      troubleshootingSteps: [
        {
          title: 'Check File Format',
          description: `Ensure your file is in one of these formats: ${supportedFormats.join(', ')}`
        },
        {
          title: 'Use Audio Converter',
          description: 'Convert your file using online tools or audio software',
          link: 'https://cloudconvert.com/audio-converter'
        },
        {
          title: 'Check File Integrity',
          description: 'Ensure the audio file is not corrupted by playing it in another application'
        }
      ],
      metadata: { supportedFormats, originalError: originalError?.message }
    });
  }
}

export class MemoryLimitationError extends SoundWaveSculptorError {
  constructor(message: string, currentUsage: number, limit: number, context: ErrorContext) {
    super({
      category: ErrorCategory.MEMORY_LIMITATION,
      severity: ErrorSeverity.HIGH,
      code: 'MEMORY_LIMIT_EXCEEDED',
      message,
      context,
      recoveryActions: [
        {
          type: 'fallback',
          label: 'Reduce Quality',
          description: 'Automatically reduce processing quality to fit within memory limits',
          action: () => {},
          autoExecute: true
        },
        {
          type: 'manual',
          label: 'Use Shorter Audio',
          description: 'Try with a shorter audio clip or select a specific segment',
          action: () => {}
        },
        {
          type: 'manual',
          label: 'Close Other Tabs',
          description: 'Close other browser tabs to free up memory',
          action: () => {}
        }
      ],
      troubleshootingSteps: [
        {
          title: 'Reduce Audio Length',
          description: 'Use audio clips shorter than 2 minutes for better performance'
        },
        {
          title: 'Lower Processing Quality',
          description: 'Reduce mesh resolution or FFT size in settings'
        },
        {
          title: 'Free Up Memory',
          description: 'Close unnecessary browser tabs and applications'
        },
        {
          title: 'Use Desktop Browser',
          description: 'Desktop browsers typically have more available memory than mobile'
        }
      ],
      metadata: { currentUsage, limit, usagePercentage: (currentUsage / limit) * 100 }
    });
  }
}

export class BrowserCompatibilityError extends SoundWaveSculptorError {
  constructor(message: string, feature: string, context: ErrorContext, fallbackAvailable: boolean = false) {
    super({
      category: ErrorCategory.BROWSER_COMPATIBILITY,
      severity: fallbackAvailable ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH,
      code: 'BROWSER_FEATURE_UNSUPPORTED',
      message,
      context,
      recoveryActions: fallbackAvailable ? [
        {
          type: 'fallback',
          label: 'Use Fallback',
          description: 'Use alternative implementation with reduced functionality',
          action: () => {},
          autoExecute: true
        }
      ] : [
        {
          type: 'manual',
          label: 'Update Browser',
          description: 'Update to the latest version of your browser',
          action: () => {}
        },
        {
          type: 'manual',
          label: 'Try Different Browser',
          description: 'Use Chrome, Firefox, Safari, or Edge for best compatibility',
          action: () => {}
        }
      ],
      troubleshootingSteps: [
        {
          title: 'Update Your Browser',
          description: 'Ensure you\'re using the latest version of your browser'
        },
        {
          title: 'Enable Required Features',
          description: 'Check if Web Audio API and WebGL are enabled in browser settings'
        },
        {
          title: 'Try Supported Browser',
          description: 'Use Chrome 66+, Firefox 60+, Safari 12+, or Edge 79+ for full compatibility'
        },
        {
          title: 'Check Extensions',
          description: 'Disable browser extensions that might block audio or WebGL features'
        }
      ],
      metadata: { feature, fallbackAvailable, userAgent: context.userAgent }
    });
  }
}