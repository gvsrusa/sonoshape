import { ParameterControls } from '../ParameterControls';
import { SculptureParams } from '../../types';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DOM environment
const mockContainer = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
};

const defaultParams: SculptureParams = {
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

describe('ParameterControls', () => {
  let container: HTMLElement;
  let controls: ParameterControls;

  beforeEach(() => {
    container = mockContainer();
    controls = new ParameterControls(container, defaultParams);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Initialization', () => {
    test('should create controls with default parameters', () => {
      expect(controls.getParameters()).toEqual(defaultParams);
    });

    test('should create all required control sections', () => {
      const sections = container.querySelectorAll('.control-section');
      expect(sections.length).toBe(4); // frequency, amplitude, style, symmetry
      
      expect(container.querySelector('.frequency-mapping')).toBeTruthy();
      expect(container.querySelector('.amplitude-mapping')).toBeTruthy();
      expect(container.querySelector('.style-controls')).toBeTruthy();
      expect(container.querySelector('.symmetry-controls')).toBeTruthy();
    });

    test('should create frequency mapping sliders', () => {
      const sliders = container.querySelectorAll('.frequency-mapping .parameter-slider');
      expect(sliders.length).toBe(3);
      
      // Check slider values match parameters
      const lowFreqSlider = sliders[0] as HTMLInputElement;
      const midFreqSlider = sliders[1] as HTMLInputElement;
      const highFreqSlider = sliders[2] as HTMLInputElement;
      
      expect(parseFloat(lowFreqSlider.value)).toBe(defaultParams.frequencyMapping.lowFreqToHeight);
      expect(parseFloat(midFreqSlider.value)).toBe(defaultParams.frequencyMapping.midFreqToWidth);
      expect(parseFloat(highFreqSlider.value)).toBe(defaultParams.frequencyMapping.highFreqToDepth);
    });

    test('should create amplitude mapping sliders', () => {
      const sliders = container.querySelectorAll('.amplitude-mapping .parameter-slider');
      expect(sliders.length).toBe(2);
      
      const sensitivitySlider = sliders[0] as HTMLInputElement;
      const smoothingSlider = sliders[1] as HTMLInputElement;
      
      expect(parseFloat(sensitivitySlider.value)).toBe(defaultParams.amplitudeMapping.sensitivity);
      expect(parseFloat(smoothingSlider.value)).toBe(defaultParams.amplitudeMapping.smoothing);
    });

    test('should create style and resolution controls', () => {
      const styleDropdown = container.querySelector('.style-controls .parameter-dropdown') as HTMLSelectElement;
      const resolutionSlider = container.querySelector('.style-controls .parameter-slider') as HTMLInputElement;
      
      expect(styleDropdown.value).toBe(defaultParams.stylePreset);
      expect(parseInt(resolutionSlider.value)).toBe(defaultParams.resolution);
    });

    test('should create symmetry control', () => {
      const symmetryDropdown = container.querySelector('.symmetry-controls .parameter-dropdown') as HTMLSelectElement;
      expect(symmetryDropdown.value).toBe(defaultParams.symmetry);
    });
  });

  describe('Parameter Updates', () => {
    test('should update parameters when slider values change', () => {
      const slider = container.querySelector('.frequency-mapping .parameter-slider') as HTMLInputElement;
      
      // Simulate slider change
      slider.value = '0.8';
      slider.dispatchEvent(new Event('input'));
      
      const updatedParams = controls.getParameters();
      expect(updatedParams.frequencyMapping.lowFreqToHeight).toBe(0.8);
    });

    test('should update parameters when dropdown values change', () => {
      const dropdown = container.querySelector('.style-controls .parameter-dropdown') as HTMLSelectElement;
      
      // Simulate dropdown change
      dropdown.value = 'geometric';
      dropdown.dispatchEvent(new Event('change'));
      
      const updatedParams = controls.getParameters();
      expect(updatedParams.stylePreset).toBe('geometric');
    });

    test('should trigger callback on parameter change', () => {
      const callback = vi.fn();
      controls.onParameterChange(callback);
      
      const slider = container.querySelector('.frequency-mapping .parameter-slider') as HTMLInputElement;
      slider.value = '0.9';
      slider.dispatchEvent(new Event('input'));
      
      expect(callback).toHaveBeenCalledWith({
        parameter: 'frequencyMapping.lowFreqToHeight',
        value: 0.9,
        params: expect.objectContaining({
          frequencyMapping: expect.objectContaining({
            lowFreqToHeight: 0.9
          })
        })
      });
    });

    test('should update value display when slider changes', () => {
      const slider = container.querySelector('.frequency-mapping .parameter-slider') as HTMLInputElement;
      const valueDisplay = slider.parentElement?.querySelector('.value-display');
      
      slider.value = '0.85';
      slider.dispatchEvent(new Event('input'));
      
      expect(valueDisplay?.textContent).toBe('0.85');
    });
  });

  describe('Parameter Validation', () => {
    test('should clamp frequency mapping values to 0-1 range', () => {
      controls.setParameters({
        frequencyMapping: {
          lowFreqToHeight: -0.5, // Below minimum
          midFreqToWidth: 1.5,   // Above maximum
          highFreqToDepth: 0.5   // Valid
        }
      });
      
      const params = controls.getParameters();
      expect(params.frequencyMapping.lowFreqToHeight).toBe(0);
      expect(params.frequencyMapping.midFreqToWidth).toBe(1);
      expect(params.frequencyMapping.highFreqToDepth).toBe(0.5);
    });

    test('should clamp amplitude sensitivity to 0-2 range', () => {
      controls.setParameters({
        amplitudeMapping: {
          sensitivity: -1,  // Below minimum
          smoothing: 0.5
        }
      });
      
      const params = controls.getParameters();
      expect(params.amplitudeMapping.sensitivity).toBe(0);
      
      controls.setParameters({
        amplitudeMapping: {
          sensitivity: 3,   // Above maximum
          smoothing: 0.5
        }
      });
      
      const updatedParams = controls.getParameters();
      expect(updatedParams.amplitudeMapping.sensitivity).toBe(2);
    });

    test('should clamp amplitude smoothing to 0-1 range', () => {
      controls.setParameters({
        amplitudeMapping: {
          sensitivity: 1.0,
          smoothing: 2.5    // Above maximum
        }
      });
      
      const params = controls.getParameters();
      expect(params.amplitudeMapping.smoothing).toBe(1);
    });

    test('should clamp resolution to 16-128 range', () => {
      controls.setParameters({ resolution: 8 }); // Below minimum
      expect(controls.getParameters().resolution).toBe(16);
      
      controls.setParameters({ resolution: 256 }); // Above maximum
      expect(controls.getParameters().resolution).toBe(128);
    });

    test('should round resolution to nearest integer', () => {
      controls.setParameters({ resolution: 63.7 });
      expect(controls.getParameters().resolution).toBe(64);
    });

    test('should validate style preset values', () => {
      controls.setParameters({ stylePreset: 'invalid' as any });
      expect(controls.getParameters().stylePreset).toBe('organic'); // Default fallback
    });

    test('should validate symmetry values', () => {
      controls.setParameters({ symmetry: 'invalid' as any });
      expect(controls.getParameters().symmetry).toBe('none'); // Default fallback
    });
  });

  describe('Programmatic Updates', () => {
    test('should update control values when parameters are set programmatically', () => {
      const newParams: Partial<SculptureParams> = {
        frequencyMapping: {
          lowFreqToHeight: 0.9,
          midFreqToWidth: 0.6,
          highFreqToDepth: 0.4
        },
        stylePreset: 'geometric'
      };
      
      controls.setParameters(newParams);
      
      // Check that sliders reflect new values
      const sliders = container.querySelectorAll('.frequency-mapping .parameter-slider') as NodeListOf<HTMLInputElement>;
      expect(parseFloat(sliders[0].value)).toBe(0.9);
      expect(parseFloat(sliders[1].value)).toBe(0.6);
      expect(parseFloat(sliders[2].value)).toBe(0.4);
      
      // Check that dropdown reflects new value
      const styleDropdown = container.querySelector('.style-controls .parameter-dropdown') as HTMLSelectElement;
      expect(styleDropdown.value).toBe('geometric');
    });

    test('should update value displays when parameters are set programmatically', () => {
      controls.setParameters({
        frequencyMapping: {
          lowFreqToHeight: 0.95,
          midFreqToWidth: 0.5,
          highFreqToDepth: 0.3
        }
      });
      
      const valueDisplay = container.querySelector('.frequency-mapping .value-display');
      expect(valueDisplay?.textContent).toBe('0.95');
    });
  });

  describe('Reset Functionality', () => {
    test('should reset to default parameters', () => {
      // Change some parameters
      controls.setParameters({
        frequencyMapping: {
          lowFreqToHeight: 0.9,
          midFreqToWidth: 0.8,
          highFreqToDepth: 0.7
        },
        stylePreset: 'geometric'
      });
      
      // Reset to defaults
      controls.resetToDefaults();
      
      const params = controls.getParameters();
      expect(params.frequencyMapping.lowFreqToHeight).toBe(0.7);
      expect(params.frequencyMapping.midFreqToWidth).toBe(0.5);
      expect(params.frequencyMapping.highFreqToDepth).toBe(0.3);
      expect(params.stylePreset).toBe('organic');
    });

    test('should trigger callback when reset', () => {
      const callback = vi.fn();
      controls.onParameterChange(callback);
      
      controls.resetToDefaults();
      
      expect(callback).toHaveBeenCalledWith({
        parameter: 'reset',
        value: expect.any(Object),
        params: expect.any(Object)
      });
    });
  });

  describe('Import/Export Functionality', () => {
    test('should export parameters as JSON', () => {
      const jsonString = controls.exportParameters();
      const parsed = JSON.parse(jsonString);
      
      expect(parsed).toEqual(defaultParams);
    });

    test('should import valid parameters from JSON', () => {
      const newParams: SculptureParams = {
        frequencyMapping: {
          lowFreqToHeight: 0.8,
          midFreqToWidth: 0.6,
          highFreqToDepth: 0.4
        },
        amplitudeMapping: {
          sensitivity: 1.5,
          smoothing: 0.7
        },
        stylePreset: 'geometric',
        resolution: 96,
        symmetry: 'radial'
      };
      
      const jsonString = JSON.stringify(newParams);
      const success = controls.importParameters(jsonString);
      
      expect(success).toBe(true);
      expect(controls.getParameters()).toEqual(newParams);
    });

    test('should reject invalid JSON', () => {
      const success = controls.importParameters('invalid json');
      expect(success).toBe(false);
    });

    test('should reject invalid parameter structure', () => {
      const invalidParams = {
        frequencyMapping: {
          lowFreqToHeight: 'invalid' // Should be number
        }
      };
      
      const success = controls.importParameters(JSON.stringify(invalidParams));
      expect(success).toBe(false);
    });
  });

  describe('Bounds Checking', () => {
    test('should enforce minimum bounds for all numeric parameters', () => {
      const belowMinParams = {
        frequencyMapping: {
          lowFreqToHeight: -1,
          midFreqToWidth: -1,
          highFreqToDepth: -1
        },
        amplitudeMapping: {
          sensitivity: -1,
          smoothing: -1
        },
        resolution: 0
      };
      
      controls.setParameters(belowMinParams);
      const params = controls.getParameters();
      
      expect(params.frequencyMapping.lowFreqToHeight).toBeGreaterThanOrEqual(0);
      expect(params.frequencyMapping.midFreqToWidth).toBeGreaterThanOrEqual(0);
      expect(params.frequencyMapping.highFreqToDepth).toBeGreaterThanOrEqual(0);
      expect(params.amplitudeMapping.sensitivity).toBeGreaterThanOrEqual(0);
      expect(params.amplitudeMapping.smoothing).toBeGreaterThanOrEqual(0);
      expect(params.resolution).toBeGreaterThanOrEqual(16);
    });

    test('should enforce maximum bounds for all numeric parameters', () => {
      const aboveMaxParams = {
        frequencyMapping: {
          lowFreqToHeight: 2,
          midFreqToWidth: 2,
          highFreqToDepth: 2
        },
        amplitudeMapping: {
          sensitivity: 5,
          smoothing: 2
        },
        resolution: 1000
      };
      
      controls.setParameters(aboveMaxParams);
      const params = controls.getParameters();
      
      expect(params.frequencyMapping.lowFreqToHeight).toBeLessThanOrEqual(1);
      expect(params.frequencyMapping.midFreqToWidth).toBeLessThanOrEqual(1);
      expect(params.frequencyMapping.highFreqToDepth).toBeLessThanOrEqual(1);
      expect(params.amplitudeMapping.sensitivity).toBeLessThanOrEqual(2);
      expect(params.amplitudeMapping.smoothing).toBeLessThanOrEqual(1);
      expect(params.resolution).toBeLessThanOrEqual(128);
    });

    test('should handle edge case values correctly', () => {
      const edgeCaseParams = {
        frequencyMapping: {
          lowFreqToHeight: 0,    // Minimum
          midFreqToWidth: 1,     // Maximum
          highFreqToDepth: 0.5   // Middle
        },
        amplitudeMapping: {
          sensitivity: 0,        // Minimum
          smoothing: 1          // Maximum
        },
        resolution: 16           // Minimum
      };
      
      controls.setParameters(edgeCaseParams);
      const params = controls.getParameters();
      
      expect(params.frequencyMapping.lowFreqToHeight).toBe(0);
      expect(params.frequencyMapping.midFreqToWidth).toBe(1);
      expect(params.frequencyMapping.highFreqToDepth).toBe(0.5);
      expect(params.amplitudeMapping.sensitivity).toBe(0);
      expect(params.amplitudeMapping.smoothing).toBe(1);
      expect(params.resolution).toBe(16);
    });
  });

  describe('Real-time Updates', () => {
    test('should handle rapid parameter changes', () => {
      const callback = vi.fn();
      controls.onParameterChange(callback);
      
      const slider = container.querySelector('.frequency-mapping .parameter-slider') as HTMLInputElement;
      
      // Simulate rapid changes
      for (let i = 0; i < 10; i++) {
        slider.value = (i * 0.1).toString();
        slider.dispatchEvent(new Event('input'));
      }
      
      expect(callback).toHaveBeenCalledTimes(10);
      expect(controls.getParameters().frequencyMapping.lowFreqToHeight).toBe(0.9);
    });

    test('should maintain parameter consistency during updates', () => {
      const callback = vi.fn();
      controls.onParameterChange(callback);
      
      // Update multiple parameters
      controls.setParameters({
        frequencyMapping: {
          lowFreqToHeight: 0.8,
          midFreqToWidth: 0.6,
          highFreqToDepth: 0.4
        },
        amplitudeMapping: {
          sensitivity: 1.2,
          smoothing: 0.8
        }
      });
      
      const params = controls.getParameters();
      
      // Verify all parameters are updated consistently
      expect(params.frequencyMapping.lowFreqToHeight).toBe(0.8);
      expect(params.frequencyMapping.midFreqToWidth).toBe(0.6);
      expect(params.frequencyMapping.highFreqToDepth).toBe(0.4);
      expect(params.amplitudeMapping.sensitivity).toBe(1.2);
      expect(params.amplitudeMapping.smoothing).toBe(0.8);
    });
  });
});