import { ParameterControls, PresetProfile, PresetTransition } from '../ParameterControls';
import { SculptureParams } from '../../types';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';


// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock requestAnimationFrame
let animationFrameCallbacks: FrameRequestCallback[] = [];
let mockTime = 0;

global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  animationFrameCallbacks.push(callback);
  return animationFrameCallbacks.length;
});

// Mock performance.now
global.performance = {
  ...global.performance,
  now: vi.fn(() => mockTime)
};

// Helper to trigger animation frames
const triggerAnimationFrames = (count: number = 1, timeStep: number = 16) => {
  for (let i = 0; i < count; i++) {
    mockTime += timeStep;
    const callbacks = [...animationFrameCallbacks];
    animationFrameCallbacks = [];
    callbacks.forEach(callback => callback(mockTime));
  }
};

describe('ParameterControls - Preset Functionality', () => {
  let container: HTMLElement;
  let parameterControls: ParameterControls;
  let initialParams: SculptureParams;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
    
    // Reset animation frame callbacks and mock time
    animationFrameCallbacks = [];
    mockTime = 0;
    
    container = document.createElement('div');
    document.body.appendChild(container);
    
    initialParams = {
      frequencyMapping: {
        lowFreqToHeight: 0.7,
        midFreqToWidth: 0.5,
        highFreqToDepth: 0.3
      },
      amplitudeMapping: {
        sensitivity: 1.0,
        smoothing: 0.5
      },
      stylePreset: 'organic',
      resolution: 64,
      symmetry: 'none'
    };
    
    parameterControls = new ParameterControls(container, initialParams);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('Built-in Presets', () => {
    test('should initialize with built-in presets', () => {
      const presets = parameterControls.getPresets();
      
      expect(presets).toHaveLength(4);
      
      const presetNames = presets.map(p => p.name);
      expect(presetNames).toContain('Organic');
      expect(presetNames).toContain('Geometric');
      expect(presetNames).toContain('Abstract');
      expect(presetNames).toContain('Architectural');
    });

    test('should have correct organic preset configuration', () => {
      const organicPreset = parameterControls.getPreset('organic');
      
      expect(organicPreset).toBeDefined();
      expect(organicPreset!.name).toBe('Organic');
      expect(organicPreset!.description).toContain('biological structures');
      expect(organicPreset!.parameters.stylePreset).toBe('organic');
      expect(organicPreset!.parameters.frequencyMapping.lowFreqToHeight).toBe(0.8);
      expect(organicPreset!.parameters.symmetry).toBe('none');
    });

    test('should have correct geometric preset configuration', () => {
      const geometricPreset = parameterControls.getPreset('geometric');
      
      expect(geometricPreset).toBeDefined();
      expect(geometricPreset!.name).toBe('Geometric');
      expect(geometricPreset!.description).toContain('mathematical precision');
      expect(geometricPreset!.parameters.stylePreset).toBe('geometric');
      expect(geometricPreset!.parameters.symmetry).toBe('bilateral');
      expect(geometricPreset!.parameters.amplitudeMapping.smoothing).toBe(0.2);
    });

    test('should have correct abstract preset configuration', () => {
      const abstractPreset = parameterControls.getPreset('abstract');
      
      expect(abstractPreset).toBeDefined();
      expect(abstractPreset!.name).toBe('Abstract');
      expect(abstractPreset!.description).toContain('artistic expression');
      expect(abstractPreset!.parameters.stylePreset).toBe('abstract');
      expect(abstractPreset!.parameters.amplitudeMapping.sensitivity).toBe(1.5);
      expect(abstractPreset!.parameters.resolution).toBe(80);
    });

    test('should have correct architectural preset configuration', () => {
      const architecturalPreset = parameterControls.getPreset('architectural');
      
      expect(architecturalPreset).toBeDefined();
      expect(architecturalPreset!.name).toBe('Architectural');
      expect(architecturalPreset!.description).toContain('buildings and monuments');
      expect(architecturalPreset!.parameters.stylePreset).toBe('architectural');
      expect(architecturalPreset!.parameters.symmetry).toBe('radial');
      expect(architecturalPreset!.parameters.frequencyMapping.lowFreqToHeight).toBe(1.0);
    });
  });

  describe('Preset Application', () => {
    test('should apply preset immediately without transition', async () => {
      const changeCallback = vi.fn();
      parameterControls.onParameterChange(changeCallback);
      
      const success = await parameterControls.applyPreset('geometric');
      
      expect(success).toBe(true);
      expect(parameterControls.getParameters().stylePreset).toBe('geometric');
      expect(parameterControls.getParameters().symmetry).toBe('bilateral');
      expect(changeCallback).toHaveBeenCalled();
    });

    test('should apply preset with smooth transition', async () => {
      const changeCallback = vi.fn();
      parameterControls.onParameterChange(changeCallback);
      
      const transition: PresetTransition = {
        duration: 100,
        easing: 'linear'
      };
      
      const applyPromise = parameterControls.applyPreset('geometric', transition);
      
      // Trigger animation frames to complete transition
      triggerAnimationFrames(10);
      
      const success = await applyPromise;
      
      expect(success).toBe(true);
      expect(parameterControls.getParameters().stylePreset).toBe('geometric');
      expect(changeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          parameter: 'preset_transition',
          value: 'Geometric'
        })
      );
    });

    test('should handle non-existent preset gracefully', async () => {
      const success = await parameterControls.applyPreset('nonexistent');
      
      expect(success).toBe(false);
      // Parameters should remain unchanged
      expect(parameterControls.getParameters()).toEqual(initialParams);
    });

    test('should prevent concurrent transitions', async () => {
      const transition: PresetTransition = {
        duration: 100,
        easing: 'linear'
      };
      
      const firstApply = parameterControls.applyPreset('geometric', transition);
      const secondApply = parameterControls.applyPreset('abstract', transition);
      
      // Trigger animation frames to complete the first transition
      triggerAnimationFrames(10, 20);
      
      const [firstResult, secondResult] = await Promise.all([firstApply, secondApply]);
      
      expect(firstResult).toBe(true);
      expect(secondResult).toBe(false);
    });
  });

  describe('Custom Presets', () => {
    test('should save custom preset', () => {
      // Modify parameters first
      parameterControls.setParameters({
        frequencyMapping: { lowFreqToHeight: 0.9, midFreqToWidth: 0.8, highFreqToDepth: 0.7 }
      });
      
      const success = parameterControls.saveAsPreset('My Custom Preset', 'A test preset');
      
      expect(success).toBe(true);
      
      const customPreset = parameterControls.getPreset('My Custom Preset');
      expect(customPreset).toBeDefined();
      expect(customPreset!.name).toBe('My Custom Preset');
      expect(customPreset!.description).toBe('A test preset');
      expect(customPreset!.parameters.frequencyMapping.lowFreqToHeight).toBe(0.9);
    });

    test('should prevent saving preset with empty name', () => {
      const success = parameterControls.saveAsPreset('', 'Description');
      
      expect(success).toBe(false);
    });

    test('should prevent overwriting built-in presets', () => {
      const success = parameterControls.saveAsPreset('organic', 'Trying to overwrite');
      
      expect(success).toBe(false);
    });

    test('should delete custom preset', () => {
      // First save a custom preset
      parameterControls.saveAsPreset('Test Preset', 'For deletion test');
      
      expect(parameterControls.getPreset('Test Preset')).toBeDefined();
      
      const success = parameterControls.deletePreset('Test Preset');
      
      expect(success).toBe(true);
      expect(parameterControls.getPreset('Test Preset')).toBeUndefined();
    });

    test('should prevent deleting built-in presets', () => {
      const success = parameterControls.deletePreset('organic');
      
      expect(success).toBe(false);
      expect(parameterControls.getPreset('organic')).toBeDefined();
    });

    test('should handle deleting non-existent preset', () => {
      const success = parameterControls.deletePreset('nonexistent');
      
      expect(success).toBe(false);
    });
  });

  describe('Preset Persistence', () => {
    test('should save custom presets to localStorage', () => {
      parameterControls.saveAsPreset('Persistent Preset', 'Should be saved');
      
      const savedData = localStorageMock.getItem('soundWaveSculptor_customPresets');
      expect(savedData).toBeTruthy();
      
      const parsedData = JSON.parse(savedData!);
      expect(parsedData['Persistent Preset']).toBeDefined();
      expect(parsedData['Persistent Preset'].name).toBe('Persistent Preset');
    });

    test('should load custom presets from localStorage', () => {
      // Manually add preset to localStorage
      const customPreset: PresetProfile = {
        name: 'Loaded Preset',
        description: 'Loaded from storage',
        parameters: {
          ...initialParams,
          resolution: 96
        }
      };
      
      localStorageMock.setItem('soundWaveSculptor_customPresets', JSON.stringify({
        'Loaded Preset': customPreset
      }));
      
      // Create new instance to trigger loading
      const newControls = new ParameterControls(document.createElement('div'), initialParams);
      
      const loadedPreset = newControls.getPreset('Loaded Preset');
      expect(loadedPreset).toBeDefined();
      expect(loadedPreset!.name).toBe('Loaded Preset');
      expect(loadedPreset!.parameters.resolution).toBe(96);
    });

    test('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.setItem('soundWaveSculptor_customPresets', 'invalid json');
      
      // Should not throw error
      expect(() => {
        new ParameterControls(document.createElement('div'), initialParams);
      }).not.toThrow();
    });
  });

  describe('Preset Import/Export', () => {
    test('should export preset as JSON', () => {
      const exportedJson = parameterControls.exportPreset('organic');
      
      expect(exportedJson).toBeTruthy();
      
      const parsed = JSON.parse(exportedJson!);
      expect(parsed.name).toBe('Organic');
      expect(parsed.parameters).toBeDefined();
      expect(parsed.parameters.stylePreset).toBe('organic');
    });

    test('should return null for non-existent preset export', () => {
      const exportedJson = parameterControls.exportPreset('nonexistent');
      
      expect(exportedJson).toBeNull();
    });

    test('should import valid preset JSON', () => {
      const presetData: PresetProfile = {
        name: 'Imported Preset',
        description: 'Imported from JSON',
        parameters: {
          ...initialParams,
          resolution: 32
        }
      };
      
      const success = parameterControls.importPreset(JSON.stringify(presetData));
      
      expect(success).toBe(true);
      
      const importedPreset = parameterControls.getPreset('Imported Preset');
      expect(importedPreset).toBeDefined();
      expect(importedPreset!.parameters.resolution).toBe(32);
    });

    test('should import preset with custom name', () => {
      const presetData: PresetProfile = {
        name: 'Original Name',
        description: 'Will be renamed',
        parameters: initialParams
      };
      
      const success = parameterControls.importPreset(JSON.stringify(presetData), 'Custom Name');
      
      expect(success).toBe(true);
      
      const importedPreset = parameterControls.getPreset('Custom Name');
      expect(importedPreset).toBeDefined();
      expect(importedPreset!.name).toBe('Custom Name');
    });

    test('should reject invalid JSON for import', () => {
      const success = parameterControls.importPreset('invalid json');
      
      expect(success).toBe(false);
    });

    test('should reject preset with invalid structure', () => {
      const invalidPreset = {
        name: 'Invalid',
        // Missing description and parameters
      };
      
      const success = parameterControls.importPreset(JSON.stringify(invalidPreset));
      
      expect(success).toBe(false);
    });

    test('should prevent importing over built-in presets', () => {
      const presetData: PresetProfile = {
        name: 'organic',
        description: 'Trying to overwrite',
        parameters: initialParams
      };
      
      const success = parameterControls.importPreset(JSON.stringify(presetData));
      
      expect(success).toBe(false);
    });
  });

  describe('Transition Easing', () => {
    test('should apply linear easing correctly', async () => {
      const changeCallback = vi.fn();
      parameterControls.onParameterChange(changeCallback);
      
      const transition: PresetTransition = {
        duration: 100,
        easing: 'linear'
      };
      
      parameterControls.applyPreset('geometric', transition);
      
      // Trigger a few animation frames
      triggerAnimationFrames(3);
      
      // Should have intermediate values due to linear interpolation
      expect(changeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          parameter: 'preset_transition'
        })
      );
    });

    test('should apply ease-in easing', async () => {
      const transition: PresetTransition = {
        duration: 100,
        easing: 'ease-in'
      };
      
      const applyPromise = parameterControls.applyPreset('geometric', transition);
      triggerAnimationFrames(10);
      
      const success = await applyPromise;
      expect(success).toBe(true);
    });

    test('should apply ease-out easing', async () => {
      const transition: PresetTransition = {
        duration: 100,
        easing: 'ease-out'
      };
      
      const applyPromise = parameterControls.applyPreset('geometric', transition);
      triggerAnimationFrames(10);
      
      const success = await applyPromise;
      expect(success).toBe(true);
    });

    test('should apply ease-in-out easing', async () => {
      const transition: PresetTransition = {
        duration: 100,
        easing: 'ease-in-out'
      };
      
      const applyPromise = parameterControls.applyPreset('geometric', transition);
      triggerAnimationFrames(10);
      
      const success = await applyPromise;
      expect(success).toBe(true);
    });
  });

  describe('Transition State Management', () => {
    test('should track transition state correctly', () => {
      expect(parameterControls.isTransitionInProgress()).toBe(false);
      
      const transition: PresetTransition = {
        duration: 1000,
        easing: 'linear'
      };
      
      parameterControls.applyPreset('geometric', transition);
      
      expect(parameterControls.isTransitionInProgress()).toBe(true);
      
      // Complete the transition
      triggerAnimationFrames(100);
      
      expect(parameterControls.isTransitionInProgress()).toBe(false);
    });
  });

  describe('Parameter Interpolation', () => {
    test('should interpolate numeric parameters correctly', async () => {
      const startParams = parameterControls.getParameters();
      const targetPreset = parameterControls.getPreset('geometric')!;
      
      const changeCallback = vi.fn();
      parameterControls.onParameterChange(changeCallback);
      
      const transition: PresetTransition = {
        duration: 100,
        easing: 'linear'
      };
      
      parameterControls.applyPreset('geometric', transition);
      
      // Trigger one animation frame to get intermediate values
      triggerAnimationFrames(1);
      
      // Should have called with interpolated values
      const lastCall = changeCallback.mock.calls[changeCallback.mock.calls.length - 1][0];
      const interpolatedParams = lastCall.params;
      
      // Values should be between start and target
      expect(interpolatedParams.frequencyMapping.lowFreqToHeight).toBeGreaterThan(startParams.frequencyMapping.lowFreqToHeight);
      expect(interpolatedParams.frequencyMapping.lowFreqToHeight).toBeLessThan(targetPreset.parameters.frequencyMapping.lowFreqToHeight);
    });

    test('should handle discrete parameters correctly during interpolation', async () => {
      const transition: PresetTransition = {
        duration: 100,
        easing: 'linear'
      };
      
      const applyPromise = parameterControls.applyPreset('geometric', transition);
      triggerAnimationFrames(10);
      
      await applyPromise;
      
      // Final values should be exactly the target values
      const finalParams = parameterControls.getParameters();
      expect(finalParams.stylePreset).toBe('geometric');
      expect(finalParams.symmetry).toBe('bilateral');
    });
  });
});