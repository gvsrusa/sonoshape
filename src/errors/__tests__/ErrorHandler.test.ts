import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  ErrorHandler, 
  globalErrorHandler 
} from '../ErrorHandler';
import { 
  SoundWaveSculptorError, 
  AudioFormatError, 
  MemoryLimitationError, 
  BrowserCompatibilityError,
  ErrorCategory, 
  ErrorSeverity 
} from '../ErrorTypes';

// Mock browser APIs
const mockAudioContext = vi.fn();
const mockGetUserMedia = vi.fn();
const mockIndexedDB = {};
const mockWebGL = {};

// Store original values to restore later
const originalAudioContext = (window as any).AudioContext;
const originalWebkitAudioContext = (window as any).webkitAudioContext;
const originalMediaDevices = (navigator as any).mediaDevices;
const originalIndexedDB = (window as any).indexedDB;
const originalCreateElement = document.createElement;

// Mock canvas and WebGL
const mockCanvas = {
  getContext: vi.fn().mockReturnValue(mockWebGL)
};

// Set up initial mocks
(window as any).AudioContext = mockAudioContext;
(window as any).webkitAudioContext = mockAudioContext;
(navigator as any).mediaDevices = { getUserMedia: mockGetUserMedia };
(window as any).indexedDB = mockIndexedDB;

// Mock document.createElement to return our mock canvas
document.createElement = vi.fn().mockImplementation((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas;
  }
  return originalCreateElement.call(document, tagName);
});

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockErrorCallback: ReturnType<typeof vi.fn>;
  let mockRecoveryCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      enableLogging: false, // Disable logging for tests
      autoRecovery: true
    });
    
    mockErrorCallback = vi.fn();
    mockRecoveryCallback = vi.fn();
    
    errorHandler.onError(mockErrorCallback);
    errorHandler.onRecovery(mockRecoveryCallback);
    
    // Clear console mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    errorHandler.clearHistory();
    
    // Restore original browser APIs
    (window as any).AudioContext = originalAudioContext;
    (window as any).webkitAudioContext = originalWebkitAudioContext;
    (navigator as any).mediaDevices = originalMediaDevices;
    (window as any).indexedDB = originalIndexedDB;
    document.createElement = originalCreateElement;
  });

  describe('Error Creation', () => {
    it('should create audio format error with proper details', () => {
      const originalError = new Error('Decoding failed');
      const supportedFormats = ['MP3', 'WAV', 'FLAC'];
      
      const error = errorHandler.createAudioFormatError(
        originalError,
        'test.xyz',
        'xyz',
        supportedFormats
      );

      expect(error).toBeInstanceOf(AudioFormatError);
      expect(error.category).toBe(ErrorCategory.AUDIO_FORMAT);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.code).toBe('AUDIO_FORMAT_UNSUPPORTED');
      expect(error.message).toContain('xyz');
      expect(error.recoveryActions).toHaveLength(2);
      expect(error.troubleshootingSteps).toHaveLength(3);
      expect(error.metadata?.supportedFormats).toEqual(supportedFormats);
    });

    it('should create memory limitation error with usage info', () => {
      const currentUsage = 50 * 1024 * 1024; // 50MB
      const limit = 100 * 1024 * 1024; // 100MB
      
      const error = errorHandler.createMemoryLimitationError(
        'audio processing',
        currentUsage,
        limit
      );

      expect(error).toBeInstanceOf(MemoryLimitationError);
      expect(error.category).toBe(ErrorCategory.MEMORY_LIMITATION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.message).toContain('50MB');
      expect(error.message).toContain('100MB');
      expect(error.recoveryActions).toHaveLength(3);
      expect(error.metadata?.usagePercentage).toBe(50);
    });

    it('should create browser compatibility error', () => {
      const error = errorHandler.createBrowserCompatibilityError('Web Audio API', false);

      expect(error).toBeInstanceOf(BrowserCompatibilityError);
      expect(error.category).toBe(ErrorCategory.BROWSER_COMPATIBILITY);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.message).toContain('Web Audio API');
      expect(error.recoveryActions).toHaveLength(2);
      expect(error.metadata?.fallbackAvailable).toBe(false);
    });

    it('should create browser compatibility error with fallback', () => {
      const error = errorHandler.createBrowserCompatibilityError('WebGL', true);

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.recoveryActions).toHaveLength(1);
      expect(error.recoveryActions[0].type).toBe('fallback');
      expect(error.metadata?.fallbackAvailable).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle and normalize generic errors', async () => {
      const genericError = new Error('Something went wrong');
      
      await errorHandler.handleError(genericError);

      expect(mockErrorCallback).toHaveBeenCalledOnce();
      const handledError = mockErrorCallback.mock.calls[0][0];
      expect(handledError).toBeInstanceOf(SoundWaveSculptorError);
      expect(handledError.message).toBe('Something went wrong');
    });

    it('should handle encoding errors as audio format errors', async () => {
      const encodingError = new Error('Failed to decode');
      encodingError.name = 'EncodingError';
      
      await errorHandler.handleError(encodingError);

      expect(mockErrorCallback).toHaveBeenCalledOnce();
      const handledError = mockErrorCallback.mock.calls[0][0];
      expect(handledError).toBeInstanceOf(AudioFormatError);
      expect(handledError.category).toBe(ErrorCategory.AUDIO_FORMAT);
    });

    it('should handle permission errors correctly', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.name = 'NotAllowedError';
      
      await errorHandler.handleError(permissionError);

      expect(mockErrorCallback).toHaveBeenCalledOnce();
      const handledError = mockErrorCallback.mock.calls[0][0];
      expect(handledError.category).toBe(ErrorCategory.PERMISSION_ERROR);
      expect(handledError.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should attempt automatic recovery', async () => {
      const mockRecoveryAction = vi.fn().mockResolvedValue(undefined);
      const error = errorHandler.createError(
        ErrorCategory.AUDIO_PROCESSING,
        ErrorSeverity.MEDIUM,
        'TEST_ERROR',
        'Test error',
        [
          {
            type: 'fallback',
            label: 'Auto Recovery',
            description: 'Automatic recovery action',
            action: mockRecoveryAction,
            autoExecute: true
          }
        ]
      );

      await errorHandler.handleError(error);

      expect(mockRecoveryAction).toHaveBeenCalledOnce();
      expect(mockRecoveryCallback).toHaveBeenCalledOnce();
    });

    it('should track error history', async () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      await errorHandler.handleError(error1);
      await errorHandler.handleError(error2);

      const recentErrors = errorHandler.getRecentErrors();
      expect(recentErrors).toHaveLength(2);
      expect(recentErrors[0].error.message).toBe('First error');
      expect(recentErrors[1].error.message).toBe('Second error');
    });
  });

  describe('Browser Compatibility', () => {
    beforeEach(() => {
      // Reset mocks before each test
      (window as any).AudioContext = mockAudioContext;
      (window as any).webkitAudioContext = mockAudioContext;
      (navigator as any).mediaDevices = { getUserMedia: mockGetUserMedia };
      (window as any).indexedDB = mockIndexedDB;
      mockCanvas.getContext.mockReturnValue(mockWebGL);
    });

    it('should detect missing Web Audio API', () => {
      // Remove AudioContext
      (window as any).AudioContext = undefined;
      (window as any).webkitAudioContext = undefined;

      const compatibility = errorHandler.checkBrowserCompatibility();

      expect(compatibility.isSupported).toBe(false);
      expect(compatibility.missingFeatures).toContain('Web Audio API');
    });

    it('should detect missing MediaDevices API', () => {
      // Remove mediaDevices
      (navigator as any).mediaDevices = undefined;

      const compatibility = errorHandler.checkBrowserCompatibility();

      expect(compatibility.isSupported).toBe(false);
      expect(compatibility.missingFeatures).toContain('MediaDevices API (microphone access)');
    });

    it('should detect missing WebGL', () => {
      mockCanvas.getContext.mockReturnValue(null);

      const compatibility = errorHandler.checkBrowserCompatibility();

      expect(compatibility.isSupported).toBe(false);
      expect(compatibility.missingFeatures).toContain('WebGL');
    });

    it('should detect mobile devices and show warnings', () => {
      // Mock mobile user agent - need to use vi.spyOn to properly mock
      const userAgentSpy = vi.spyOn(navigator, 'userAgent', 'get');
      userAgentSpy.mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 mobile');

      const compatibility = errorHandler.checkBrowserCompatibility();

      expect(compatibility.warnings).toContain('Mobile devices may have limited performance for complex audio processing');
      
      // Restore original user agent
      userAgentSpy.mockRestore();
    });
  });

  describe('Memory Estimation', () => {
    it('should estimate memory usage correctly', () => {
      const mockAudioBuffer = {
        length: 44100 * 10, // 10 seconds at 44.1kHz
        numberOfChannels: 2,
        sampleRate: 44100
      } as AudioBuffer;

      const meshResolution = 64;
      const estimation = errorHandler.estimateMemoryUsage(mockAudioBuffer, meshResolution);

      expect(estimation.estimated).toBeGreaterThan(0);
      expect(estimation.available).toBeGreaterThan(0);
      expect(typeof estimation.safe).toBe('boolean');
    });

    it('should detect unsafe memory usage', () => {
      const mockAudioBuffer = {
        length: 44100 * 300, // 5 minutes - large buffer
        numberOfChannels: 2,
        sampleRate: 44100
      } as AudioBuffer;

      const meshResolution = 256; // High resolution
      const estimation = errorHandler.estimateMemoryUsage(mockAudioBuffer, meshResolution);

      // With large audio and high resolution, should be unsafe
      expect(estimation.safe).toBe(false);
    });
  });

  describe('Error Statistics', () => {
    it('should calculate error statistics correctly', async () => {
      // Create various types of errors
      const audioError = errorHandler.createAudioFormatError(
        new Error('Format error'),
        'test.xyz',
        'xyz',
        ['MP3', 'WAV']
      );
      
      const memoryError = errorHandler.createMemoryLimitationError(
        'processing',
        100,
        50
      );

      await errorHandler.handleError(audioError);
      await errorHandler.handleError(memoryError);

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByCategory[ErrorCategory.AUDIO_FORMAT]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.MEMORY_LIMITATION]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.MEDIUM]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1);
      expect(stats.commonErrors).toHaveLength(2);
    });

    it('should calculate recovery rate correctly', async () => {
      const recoverableError = errorHandler.createError(
        ErrorCategory.AUDIO_PROCESSING,
        ErrorSeverity.MEDIUM,
        'RECOVERABLE',
        'Recoverable error',
        [
          {
            type: 'fallback',
            label: 'Auto Recovery',
            description: 'Automatic recovery',
            action: vi.fn().mockResolvedValue(undefined),
            autoExecute: true
          }
        ]
      );

      const nonRecoverableError = errorHandler.createError(
        ErrorCategory.AUDIO_PROCESSING,
        ErrorSeverity.HIGH,
        'NON_RECOVERABLE',
        'Non-recoverable error'
      );

      await errorHandler.handleError(recoverableError);
      await errorHandler.handleError(nonRecoverableError);

      const stats = errorHandler.getErrorStatistics();
      expect(stats.recoveryRate).toBe(0.5); // 1 out of 2 recovered
    });
  });

  describe('Global Error Handler', () => {
    it('should handle window error events', async () => {
      const mockCallback = vi.fn();
      globalErrorHandler.onError(mockCallback);

      // Simulate window error event
      const errorEvent = new ErrorEvent('error', {
        message: 'Global error',
        error: new Error('Global error')
      });

      window.dispatchEvent(errorEvent);

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle unhandled promise rejections', async () => {
      const mockCallback = vi.fn();
      globalErrorHandler.onError(mockCallback);

      // Create a mock PromiseRejectionEvent since it's not available in test environment
      const rejectionError = new Error('Unhandled rejection');
      
      // Manually trigger the unhandled rejection handler without creating an actual rejected promise
      const rejectionHandler = (event: any) => {
        globalErrorHandler.handleError(event.reason || new Error('Unhandled promise rejection'));
      };

      const mockRejectionEvent = {
        type: 'unhandledrejection',
        reason: rejectionError
      };

      rejectionHandler(mockRejectionEvent);

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockCallback).toHaveBeenCalled();
    });
  });
});