import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioController } from '../AudioController';

// Mock MediaDevices API
const mockGetUserMedia = vi.fn();
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  onstop: null as any,
  ondataavailable: null as any,
  state: 'inactive'
};

const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }])
};

// Mock Blob with arrayBuffer method
const mockBlob = {
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
};

// Mock Blob constructor
(global as any).Blob = vi.fn().mockImplementation(() => mockBlob);

// Mock MediaRecorder constructor
(global as any).MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder);
(global as any).MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia
  }
});

// Mock AudioContext
const mockAudioContext = {
  createMediaStreamSource: vi.fn(() => ({
    connect: vi.fn()
  })),
  createAnalyser: vi.fn(() => ({
    fftSize: 256,
    smoothingTimeConstant: 0.8,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
    disconnect: vi.fn()
  })),
  decodeAudioData: vi.fn(),
  sampleRate: 44100,
  currentTime: 0,
  state: 'running',
  resume: vi.fn(),
  close: vi.fn()
};

(global as any).AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
(global as any).webkitAudioContext = (global as any).AudioContext;

describe('AudioController Live Capture', () => {
  let audioController: AudioController;

  beforeEach(() => {
    audioController = new AudioController();
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue(mockMediaStream);
    
    // Mock decodeAudioData to return a valid AudioBuffer
    const mockAudioBuffer = {
      duration: 10,
      sampleRate: 44100,
      numberOfChannels: 1,
      length: 441000,
      getChannelData: vi.fn(() => new Float32Array(441000))
    };
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
  });

  afterEach(() => {
    audioController.dispose();
  });

  describe('Live Capture Support Detection', () => {
    it('should detect live capture support when APIs are available', () => {
      expect(audioController.isLiveCaptureSupported()).toBe(true);
    });

    it('should detect no support when MediaDevices is not available', () => {
      const originalMediaDevices = navigator.mediaDevices;
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: undefined
      });
      
      expect(audioController.isLiveCaptureSupported()).toBe(false);
      
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: originalMediaDevices
      });
    });
  });

  describe('Duration Validation', () => {
    it('should reject duration less than minimum', async () => {
      await expect(audioController.startLiveCapture(3)).rejects.toThrow(
        'Recording duration must be between 5 and 120 seconds'
      );
    });

    it('should reject duration greater than maximum', async () => {
      await expect(audioController.startLiveCapture(150)).rejects.toThrow(
        'Recording duration must be between 5 and 120 seconds'
      );
    });

    it('should accept valid duration', async () => {
      // Mock audio data being available
      const mockArrayBuffer = new ArrayBuffer(8);
      const mockAudioBuffer = {
        duration: 10,
        sampleRate: 44100,
        numberOfChannels: 1
      };
      
      const mockAudioBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        size: 1024
      };
      
      mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
      
      const promise = audioController.startLiveCapture(10);
      
      // Wait for setup
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate recording stop with data
      setTimeout(() => {
        // First trigger data available
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockAudioBlob });
        }
        // Then trigger stop
        if (mockMediaRecorder.onstop) {
          mockMediaRecorder.onstop();
        }
      }, 20);

      // Should resolve with audio buffer
      await expect(promise).resolves.toBeDefined();
    });
  });

  describe('Permission Handling', () => {
    it('should handle permission denied error', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(permissionError);

      await expect(audioController.startLiveCapture(10)).rejects.toThrow(
        'Microphone access was denied'
      );
    });

    it('should handle device not found error', async () => {
      const deviceError = new Error('Device not found');
      deviceError.name = 'NotFoundError';
      mockGetUserMedia.mockRejectedValue(deviceError);

      await expect(audioController.startLiveCapture(10)).rejects.toThrow(
        'No microphone device found'
      );
    });

    it('should handle constraint not satisfied error', async () => {
      const constraintError = new Error('Constraint not satisfied');
      constraintError.name = 'OverconstrainedError';
      mockGetUserMedia.mockRejectedValue(constraintError);

      await expect(audioController.startLiveCapture(10)).rejects.toThrow(
        'Microphone does not support the required audio settings'
      );
    });
  });

  describe('Recording State Management', () => {
    it('should provide initial recording state', () => {
      const state = audioController.getRecordingState();
      
      expect(state.isRecording).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.currentDuration).toBe(0);
      expect(state.maxDuration).toBe(120);
      expect(state.audioLevel).toBe(0);
    });

    it('should call state change callback during recording', async () => {
      const onStateChange = vi.fn();
      
      const promise = audioController.startLiveCapture(10, onStateChange);
      
      // Wait for initial state change
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(onStateChange).toHaveBeenCalled();
      
      // Stop recording
      audioController.stopLiveCapture();
      
      // Simulate recording stop
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop();
      }
      
      await promise.catch(() => {}); // Ignore errors for this test
    });
  });

  describe('Recording Controls', () => {
    it('should start recording with MediaRecorder', async () => {
      const promise = audioController.startLiveCapture(10);
      
      // Wait for setup
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockMediaRecorder.start).toHaveBeenCalled();
      
      // Stop recording
      audioController.stopLiveCapture();
      expect(mockMediaRecorder.stop).toHaveBeenCalled();
      
      // Simulate recording stop
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop();
      }
      
      await promise.catch(() => {}); // Ignore errors for this test
    });

    it('should pause and resume recording', async () => {
      const promise = audioController.startLiveCapture(10);
      
      // Wait for setup
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Pause recording
      audioController.pauseLiveCapture();
      expect(mockMediaRecorder.pause).toHaveBeenCalled();
      
      // Resume recording
      audioController.resumeLiveCapture();
      expect(mockMediaRecorder.resume).toHaveBeenCalled();
      
      // Stop recording
      audioController.stopLiveCapture();
      
      // Simulate recording stop
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop();
      }
      
      await promise.catch(() => {}); // Ignore errors for this test
    });
  });

  describe('Audio Level Monitoring', () => {
    it('should call level update callback during recording', async () => {
      const onLevelUpdate = vi.fn();
      
      const promise = audioController.startLiveCapture(10, undefined, onLevelUpdate);
      
      // Wait for setup and level monitoring to start
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Level updates should be called (may be called multiple times)
      expect(onLevelUpdate).toHaveBeenCalled();
      
      // Stop recording
      audioController.stopLiveCapture();
      
      // Simulate recording stop
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop();
      }
      
      await promise.catch(() => {}); // Ignore errors for this test
    });
  });

  describe('Error Handling', () => {
    it('should call error callback on recording error', async () => {
      const onError = vi.fn();
      const permissionError = new Error('Permission denied');
      permissionError.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(permissionError);

      await audioController.startLiveCapture(10, undefined, undefined, onError).catch(() => {});

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'permission-denied',
          message: expect.stringContaining('Microphone access was denied')
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on dispose', async () => {
      const mockTrack = { stop: vi.fn() };
      const mockStreamWithTracks = {
        getTracks: vi.fn(() => [mockTrack])
      };
      mockGetUserMedia.mockResolvedValue(mockStreamWithTracks);
      
      const promise = audioController.startLiveCapture(10);
      
      // Wait for setup to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Dispose should clean up everything
      audioController.dispose();
      
      expect(mockTrack.stop).toHaveBeenCalled();
      
      // Simulate recording stop to prevent hanging promise
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop();
      }
      
      await promise.catch(() => {}); // Ignore errors for this test
    });
  });
});