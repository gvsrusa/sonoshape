import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProgressTracker, ProgressManager, globalProgressManager } from '../ProgressTracker';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;
  let mockCallbacks: any;

  beforeEach(() => {
    mockCallbacks = {
      onProgress: vi.fn(),
      onStepStart: vi.fn(),
      onStepComplete: vi.fn(),
      onStepFailed: vi.fn(),
      onComplete: vi.fn(),
      onFailed: vi.fn(),
      onCancelled: vi.fn()
    };

    tracker = new ProgressTracker(
      'test-operation',
      'Test Operation',
      [
        { id: 'step1', name: 'Step 1', description: 'First step', weight: 1 },
        { id: 'step2', name: 'Step 2', description: 'Second step', weight: 2 },
        { id: 'step3', name: 'Step 3', description: 'Third step', weight: 1 }
      ],
      mockCallbacks
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct state', () => {
      const state = tracker.getState();

      expect(state.operationId).toBe('test-operation');
      expect(state.operationName).toBe('Test Operation');
      expect(state.steps).toHaveLength(3);
      expect(state.overallProgress).toBe(0);
      expect(state.status).toBe('pending');
      expect(state.canCancel).toBe(true);
    });

    it('should initialize steps with pending status', () => {
      const state = tracker.getState();

      state.steps.forEach(step => {
        expect(step.status).toBe('pending');
        expect(step.progress).toBe(0);
      });
    });
  });

  describe('Operation Lifecycle', () => {
    it('should start operation correctly', () => {
      tracker.start();
      const state = tracker.getState();

      expect(state.status).toBe('in-progress');
      expect(mockCallbacks.onProgress).toHaveBeenCalled();
    });

    it('should not allow starting already started operation', () => {
      tracker.start();
      
      expect(() => tracker.start()).toThrow('Operation already started');
    });

    it('should complete operation when all steps are done', () => {
      tracker.start();
      
      tracker.startStep('step1');
      tracker.completeStep('step1');
      
      tracker.startStep('step2');
      tracker.completeStep('step2');
      
      tracker.startStep('step3');
      tracker.completeStep('step3');

      const state = tracker.getState();
      expect(state.status).toBe('completed');
      expect(state.overallProgress).toBe(100);
      expect(mockCallbacks.onComplete).toHaveBeenCalled();
    });
  });

  describe('Step Management', () => {
    beforeEach(() => {
      tracker.start();
    });

    it('should start step correctly', () => {
      tracker.startStep('step1');
      const state = tracker.getState();
      const step = state.steps.find(s => s.id === 'step1');

      expect(step?.status).toBe('in-progress');
      expect(step?.startTime).toBeDefined();
      expect(state.currentStep?.id).toBe('step1');
      expect(mockCallbacks.onStepStart).toHaveBeenCalledWith(step, state);
    });

    it('should not allow starting non-existent step', () => {
      expect(() => tracker.startStep('invalid-step')).toThrow('Step invalid-step not found');
    });

    it('should not allow starting already started step', () => {
      tracker.startStep('step1');
      
      expect(() => tracker.startStep('step1')).toThrow('Step step1 already started');
    });

    it('should update step progress correctly', () => {
      tracker.startStep('step1');
      tracker.updateStepProgress('step1', 50, 'Half done');

      const state = tracker.getState();
      const step = state.steps.find(s => s.id === 'step1');

      expect(step?.progress).toBe(50);
      expect(step?.description).toBe('Half done');
      expect(mockCallbacks.onProgress).toHaveBeenCalled();
    });

    it('should clamp progress values', () => {
      tracker.startStep('step1');
      tracker.updateStepProgress('step1', 150); // Over 100

      const state = tracker.getState();
      const step = state.steps.find(s => s.id === 'step1');

      expect(step?.progress).toBe(100);
    });

    it('should complete step correctly', () => {
      tracker.startStep('step1');
      tracker.completeStep('step1');

      const state = tracker.getState();
      const step = state.steps.find(s => s.id === 'step1');

      expect(step?.status).toBe('completed');
      expect(step?.progress).toBe(100);
      expect(step?.endTime).toBeDefined();
      expect(mockCallbacks.onStepComplete).toHaveBeenCalledWith(step, state);
    });

    it('should fail step correctly', () => {
      const error = new Error('Step failed');
      tracker.startStep('step1');
      tracker.failStep('step1', error);

      const state = tracker.getState();
      const step = state.steps.find(s => s.id === 'step1');

      expect(step?.status).toBe('failed');
      expect(step?.error).toBe(error);
      expect(state.status).toBe('failed');
      expect(mockCallbacks.onStepFailed).toHaveBeenCalledWith(step, error, state);
      expect(mockCallbacks.onFailed).toHaveBeenCalledWith(error, state);
    });
  });

  describe('Progress Calculation', () => {
    beforeEach(() => {
      tracker.start();
    });

    it('should calculate overall progress based on step weights', () => {
      // Step weights: step1=1, step2=2, step3=1 (total=4)
      
      tracker.startStep('step1');
      tracker.updateStepProgress('step1', 100); // 1/4 * 100 = 25%
      
      let state = tracker.getState();
      expect(state.overallProgress).toBe(25);

      tracker.completeStep('step1');
      tracker.startStep('step2');
      tracker.updateStepProgress('step2', 50); // 25% + (2/4 * 50) = 50%
      
      state = tracker.getState();
      expect(state.overallProgress).toBe(50);
    });

    it('should handle completed steps in progress calculation', () => {
      tracker.startStep('step1');
      tracker.completeStep('step1'); // Should count as 100% for this step

      const state = tracker.getState();
      expect(state.overallProgress).toBe(25); // 1/4 * 100
    });
  });

  describe('Cancellation', () => {
    it('should cancel operation correctly', () => {
      tracker.start();
      tracker.startStep('step1');
      tracker.cancel();

      const state = tracker.getState();
      expect(state.status).toBe('cancelled');
      expect(tracker.isCancelled()).toBe(true);
      expect(mockCallbacks.onCancelled).toHaveBeenCalled();

      // In-progress steps should be cancelled
      const step = state.steps.find(s => s.id === 'step1');
      expect(step?.status).toBe('cancelled');
    });

    it('should not allow operations after cancellation', () => {
      tracker.start();
      tracker.cancel();

      expect(() => tracker.startStep('step1')).toThrow('Operation was cancelled');
    });

    it('should not cancel non-cancellable operations', () => {
      const nonCancellableTracker = new ProgressTracker(
        'non-cancellable',
        'Non-cancellable Operation',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }],
        {},
        false // canCancel = false
      );

      nonCancellableTracker.start();
      nonCancellableTracker.cancel();

      const state = nonCancellableTracker.getState();
      expect(state.status).toBe('in-progress'); // Should not be cancelled
    });
  });

  describe('Time Estimation', () => {
    beforeEach(() => {
      tracker.start();
    });

    it('should provide estimated completion time', () => {
      tracker.startStep('step1');
      tracker.updateStepProgress('step1', 50);

      // Wait a bit for progress history to build
      setTimeout(() => {
        const estimatedCompletion = tracker.getEstimatedCompletion();
        expect(estimatedCompletion).toBeInstanceOf(Date);
      }, 100);
    });

    it('should calculate operation duration', () => {
      const startTime = Date.now();
      
      setTimeout(() => {
        const duration = tracker.getDuration();
        expect(duration).toBeGreaterThan(0);
        expect(duration).toBeLessThan(1000); // Should be less than 1 second for this test
      }, 10);
    });
  });
});

describe('ProgressManager', () => {
  let manager: ProgressManager;
  let mockGlobalCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    manager = new ProgressManager();
    mockGlobalCallback = vi.fn();
    manager.onProgress(mockGlobalCallback);
  });

  afterEach(() => {
    manager.cancelAll();
    vi.clearAllMocks();
  });

  describe('Tracker Management', () => {
    it('should create and register tracker', () => {
      const tracker = manager.createTracker(
        'test-op',
        'Test Operation',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      expect(tracker).toBeInstanceOf(ProgressTracker);
      expect(manager.getTracker('test-op')).toBe(tracker);
    });

    it('should not allow duplicate tracker IDs', () => {
      manager.createTracker(
        'duplicate-id',
        'First Operation',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      expect(() => {
        manager.createTracker(
          'duplicate-id',
          'Second Operation',
          [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
        );
      }).toThrow('Tracker with ID duplicate-id already exists');
    });

    it('should remove tracker correctly', () => {
      const tracker = manager.createTracker(
        'removable',
        'Removable Operation',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      manager.removeTracker('removable');
      expect(manager.getTracker('removable')).toBeUndefined();
      expect(tracker.isCancelled()).toBe(true);
    });

    it('should get active trackers only', () => {
      const tracker1 = manager.createTracker(
        'active1',
        'Active Operation 1',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      const tracker2 = manager.createTracker(
        'active2',
        'Active Operation 2',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      const tracker3 = manager.createTracker(
        'inactive',
        'Inactive Operation',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      tracker1.start();
      tracker2.start();
      // tracker3 remains pending

      const activeTrackers = manager.getActiveTrackers();
      expect(activeTrackers).toHaveLength(2);
      expect(activeTrackers).toContain(tracker1);
      expect(activeTrackers).toContain(tracker2);
      expect(activeTrackers).not.toContain(tracker3);
    });

    it('should cancel all trackers', () => {
      const tracker1 = manager.createTracker(
        'cancel1',
        'Cancel Operation 1',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      const tracker2 = manager.createTracker(
        'cancel2',
        'Cancel Operation 2',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      tracker1.start();
      tracker2.start();

      manager.cancelAll();

      expect(tracker1.isCancelled()).toBe(true);
      expect(tracker2.isCancelled()).toBe(true);
    });

    it('should clear completed trackers', () => {
      const completedTracker = manager.createTracker(
        'completed',
        'Completed Operation',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      const activeTracker = manager.createTracker(
        'active',
        'Active Operation',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      // Complete first tracker
      completedTracker.start();
      completedTracker.startStep('step1');
      completedTracker.completeStep('step1');

      // Start second tracker but don't complete
      activeTracker.start();

      manager.clearCompleted();

      expect(manager.getTracker('completed')).toBeUndefined();
      expect(manager.getTracker('active')).toBe(activeTracker);
    });
  });

  describe('Global Callbacks', () => {
    it('should call global callback on progress updates', () => {
      const tracker = manager.createTracker(
        'global-test',
        'Global Test Operation',
        [{ id: 'step1', name: 'Step 1', description: 'Step', weight: 1 }]
      );

      tracker.start();
      tracker.startStep('step1');
      tracker.updateStepProgress('step1', 50);

      expect(mockGlobalCallback).toHaveBeenCalled();
    });
  });
});

describe('Global Progress Manager', () => {
  it('should be available as singleton', () => {
    expect(globalProgressManager).toBeInstanceOf(ProgressManager);
  });
});