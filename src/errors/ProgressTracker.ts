/**
 * Progress tracking and user feedback system
 */

export interface ProgressStep {
  id: string;
  name: string;
  description: string;
  weight: number; // Relative weight for progress calculation
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  startTime?: number;
  endTime?: number;
  error?: Error;
}

export interface ProgressState {
  operationId: string;
  operationName: string;
  steps: ProgressStep[];
  overallProgress: number;
  currentStep?: ProgressStep;
  startTime: number;
  estimatedDuration?: number;
  remainingTime?: number;
  canCancel: boolean;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
}

export interface ProgressCallback {
  onProgress?: (state: ProgressState) => void;
  onStepStart?: (step: ProgressStep, state: ProgressState) => void;
  onStepComplete?: (step: ProgressStep, state: ProgressState) => void;
  onStepFailed?: (step: ProgressStep, error: Error, state: ProgressState) => void;
  onComplete?: (state: ProgressState) => void;
  onFailed?: (error: Error, state: ProgressState) => void;
  onCancelled?: (state: ProgressState) => void;
}

export class ProgressTracker {
  private state: ProgressState;
  private callbacks: ProgressCallback;
  private cancelled: boolean = false;
  private progressHistory: number[] = [];
  private updateInterval?: number;

  constructor(
    operationId: string,
    operationName: string,
    steps: Omit<ProgressStep, 'status' | 'progress' | 'startTime' | 'endTime'>[],
    callbacks: ProgressCallback = {},
    canCancel: boolean = true
  ) {
    this.callbacks = callbacks;
    this.state = {
      operationId,
      operationName,
      steps: steps.map(step => ({
        ...step,
        status: 'pending' as const,
        progress: 0
      })),
      overallProgress: 0,
      startTime: Date.now(),
      canCancel,
      status: 'pending'
    };

    this.calculateEstimatedDuration();
  }

  /**
   * Start the operation
   */
  start(): void {
    if (this.state.status !== 'pending') {
      throw new Error('Operation already started');
    }

    this.state.status = 'in-progress';
    this.state.startTime = Date.now();
    this.startProgressUpdates();
    this.notifyProgress();
  }

  /**
   * Start a specific step
   */
  startStep(stepId: string): void {
    if (this.cancelled) {
      throw new Error('Operation was cancelled');
    }

    const step = this.findStep(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    if (step.status !== 'pending') {
      throw new Error(`Step ${stepId} already started`);
    }

    step.status = 'in-progress';
    step.startTime = Date.now();
    step.progress = 0;
    this.state.currentStep = step;

    this.updateOverallProgress();
    this.updateRemainingTime();

    if (this.callbacks.onStepStart) {
      this.callbacks.onStepStart(step, this.state);
    }

    this.notifyProgress();
  }

  /**
   * Update progress for a specific step
   */
  updateStepProgress(stepId: string, progress: number, description?: string): void {
    if (this.cancelled) {
      return;
    }

    const step = this.findStep(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    if (step.status !== 'in-progress') {
      throw new Error(`Step ${stepId} is not in progress`);
    }

    step.progress = Math.max(0, Math.min(100, progress));
    if (description) {
      step.description = description;
    }

    this.updateOverallProgress();
    this.updateRemainingTime();
    this.notifyProgress();
  }

  /**
   * Complete a specific step
   */
  completeStep(stepId: string): void {
    if (this.cancelled) {
      return;
    }

    const step = this.findStep(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    step.status = 'completed';
    step.progress = 100;
    step.endTime = Date.now();

    this.updateOverallProgress();
    this.updateRemainingTime();

    if (this.callbacks.onStepComplete) {
      this.callbacks.onStepComplete(step, this.state);
    }

    // Check if all steps are completed
    if (this.state.steps.every(s => s.status === 'completed')) {
      this.complete();
    } else {
      this.notifyProgress();
    }
  }

  /**
   * Fail a specific step
   */
  failStep(stepId: string, error: Error): void {
    const step = this.findStep(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    step.status = 'failed';
    step.error = error;
    step.endTime = Date.now();

    this.state.status = 'failed';
    this.stopProgressUpdates();

    if (this.callbacks.onStepFailed) {
      this.callbacks.onStepFailed(step, error, this.state);
    }

    if (this.callbacks.onFailed) {
      this.callbacks.onFailed(error, this.state);
    }
  }

  /**
   * Cancel the operation
   */
  cancel(): void {
    if (!this.state.canCancel || this.state.status === 'completed' || this.state.status === 'failed') {
      return;
    }

    this.cancelled = true;
    this.state.status = 'cancelled';
    
    // Cancel any in-progress steps
    this.state.steps.forEach(step => {
      if (step.status === 'in-progress') {
        step.status = 'cancelled';
        step.endTime = Date.now();
      }
    });

    this.stopProgressUpdates();

    if (this.callbacks.onCancelled) {
      this.callbacks.onCancelled(this.state);
    }
  }

  /**
   * Complete the operation
   */
  private complete(): void {
    this.state.status = 'completed';
    this.state.overallProgress = 100;
    this.stopProgressUpdates();

    if (this.callbacks.onComplete) {
      this.callbacks.onComplete(this.state);
    }
  }

  /**
   * Get current state
   */
  getState(): ProgressState {
    return { ...this.state };
  }

  /**
   * Check if operation is cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Get estimated completion time
   */
  getEstimatedCompletion(): Date | null {
    if (!this.state.remainingTime) {
      return null;
    }

    return new Date(Date.now() + this.state.remainingTime);
  }

  /**
   * Get operation duration
   */
  getDuration(): number {
    const endTime = this.state.status === 'completed' || this.state.status === 'failed' || this.state.status === 'cancelled'
      ? Math.max(...this.state.steps.map(s => s.endTime || Date.now()))
      : Date.now();

    return endTime - this.state.startTime;
  }

  /**
   * Find step by ID
   */
  private findStep(stepId: string): ProgressStep | undefined {
    return this.state.steps.find(step => step.id === stepId);
  }

  /**
   * Update overall progress based on step weights and progress
   */
  private updateOverallProgress(): void {
    const totalWeight = this.state.steps.reduce((sum, step) => sum + step.weight, 0);
    const weightedProgress = this.state.steps.reduce((sum, step) => {
      const stepProgress = step.status === 'completed' ? 100 : step.progress;
      return sum + (stepProgress * step.weight);
    }, 0);

    this.state.overallProgress = totalWeight > 0 ? weightedProgress / totalWeight : 0;
    this.progressHistory.push(this.state.overallProgress);

    // Keep only recent history for performance
    if (this.progressHistory.length > 100) {
      this.progressHistory = this.progressHistory.slice(-50);
    }
  }

  /**
   * Calculate estimated duration based on step weights
   */
  private calculateEstimatedDuration(): void {
    // This is a rough estimate based on typical operation times
    const baseTimePerStep = 2000; // 2 seconds per step
    const totalWeight = this.state.steps.reduce((sum, step) => sum + step.weight, 0);
    this.state.estimatedDuration = totalWeight * baseTimePerStep;
  }

  /**
   * Update remaining time estimate
   */
  private updateRemainingTime(): void {
    if (this.state.overallProgress <= 0 || this.progressHistory.length < 2) {
      return;
    }

    // Calculate progress rate from recent history
    const recentHistory = this.progressHistory.slice(-10);
    const timePerProgressPoint = 1000; // Assuming updates every second
    const progressRate = (recentHistory[recentHistory.length - 1] - recentHistory[0]) / (recentHistory.length - 1);

    if (progressRate > 0) {
      const remainingProgress = 100 - this.state.overallProgress;
      this.state.remainingTime = (remainingProgress / progressRate) * timePerProgressPoint;
    }
  }

  /**
   * Start periodic progress updates
   */
  private startProgressUpdates(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateRemainingTime();
      this.notifyProgress();
    }, 1000);
  }

  /**
   * Stop periodic progress updates
   */
  private stopProgressUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * Notify progress callback
   */
  private notifyProgress(): void {
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(this.state);
    }
  }
}

/**
 * Utility class for managing multiple progress trackers
 */
export class ProgressManager {
  private trackers = new Map<string, ProgressTracker>();
  private globalCallback?: (tracker: ProgressTracker) => void;

  /**
   * Set global progress callback
   */
  onProgress(callback: (tracker: ProgressTracker) => void): void {
    this.globalCallback = callback;
  }

  /**
   * Create and register a new progress tracker
   */
  createTracker(
    operationId: string,
    operationName: string,
    steps: Omit<ProgressStep, 'status' | 'progress' | 'startTime' | 'endTime'>[],
    callbacks: ProgressCallback = {},
    canCancel: boolean = true
  ): ProgressTracker {
    if (this.trackers.has(operationId)) {
      throw new Error(`Tracker with ID ${operationId} already exists`);
    }

    const enhancedCallbacks: ProgressCallback = {
      ...callbacks,
      onProgress: (state) => {
        if (callbacks.onProgress) {
          callbacks.onProgress(state);
        }
        if (this.globalCallback) {
          this.globalCallback(this.trackers.get(operationId)!);
        }
      }
    };

    const tracker = new ProgressTracker(operationId, operationName, steps, enhancedCallbacks, canCancel);
    this.trackers.set(operationId, tracker);

    return tracker;
  }

  /**
   * Get tracker by ID
   */
  getTracker(operationId: string): ProgressTracker | undefined {
    return this.trackers.get(operationId);
  }

  /**
   * Remove tracker
   */
  removeTracker(operationId: string): void {
    const tracker = this.trackers.get(operationId);
    if (tracker) {
      tracker.cancel();
      this.trackers.delete(operationId);
    }
  }

  /**
   * Get all active trackers
   */
  getActiveTrackers(): ProgressTracker[] {
    return Array.from(this.trackers.values()).filter(
      tracker => tracker.getState().status === 'in-progress'
    );
  }

  /**
   * Cancel all active operations
   */
  cancelAll(): void {
    this.trackers.forEach(tracker => tracker.cancel());
  }

  /**
   * Clear completed trackers
   */
  clearCompleted(): void {
    const toRemove: string[] = [];
    this.trackers.forEach((tracker, id) => {
      const state = tracker.getState();
      if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.trackers.delete(id));
  }
}

// Global progress manager instance
export const globalProgressManager = new ProgressManager();