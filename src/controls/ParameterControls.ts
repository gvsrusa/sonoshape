import { SculptureParams } from '../types';

export interface ParameterChangeEvent {
  parameter: keyof SculptureParams | string;
  value: any;
  params: SculptureParams;
}

export type ParameterChangeCallback = (event: ParameterChangeEvent) => void;

export interface PresetProfile {
  name: string;
  description: string;
  parameters: SculptureParams;
}

export interface PresetTransition {
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export class ParameterControls {
  private container: HTMLElement;
  private params: SculptureParams;
  private changeCallback?: ParameterChangeCallback;
  private controls: Map<string, HTMLElement> = new Map();
  private presets: Map<string, PresetProfile> = new Map();
  private isTransitioning: boolean = false;

  constructor(container: HTMLElement, initialParams: SculptureParams) {
    this.container = container;
    this.params = { ...initialParams };
    this.initializePresets();
    this.createControls();
  }

  /**
   * Initialize preset configurations
   */
  private initializePresets(): void {
    // Define built-in presets
    this.presets.set('organic', {
      name: 'Organic',
      description: 'Flowing, natural forms inspired by biological structures',
      parameters: {
        frequencyMapping: {
          lowFreqToHeight: 0.8,
          midFreqToWidth: 0.6,
          highFreqToDepth: 0.4
        },
        amplitudeMapping: {
          sensitivity: 1.2,
          smoothing: 0.7
        },
        stylePreset: 'organic',
        resolution: 64,
        symmetry: 'none'
      }
    });

    this.presets.set('geometric', {
      name: 'Geometric',
      description: 'Clean, angular forms with mathematical precision',
      parameters: {
        frequencyMapping: {
          lowFreqToHeight: 0.9,
          midFreqToWidth: 0.3,
          highFreqToDepth: 0.6
        },
        amplitudeMapping: {
          sensitivity: 0.8,
          smoothing: 0.2
        },
        stylePreset: 'geometric',
        resolution: 48,
        symmetry: 'bilateral'
      }
    });

    this.presets.set('abstract', {
      name: 'Abstract',
      description: 'Experimental forms that emphasize artistic expression',
      parameters: {
        frequencyMapping: {
          lowFreqToHeight: 0.5,
          midFreqToWidth: 0.8,
          highFreqToDepth: 0.7
        },
        amplitudeMapping: {
          sensitivity: 1.5,
          smoothing: 0.3
        },
        stylePreset: 'abstract',
        resolution: 80,
        symmetry: 'none'
      }
    });

    this.presets.set('architectural', {
      name: 'Architectural',
      description: 'Structured forms reminiscent of buildings and monuments',
      parameters: {
        frequencyMapping: {
          lowFreqToHeight: 1.0,
          midFreqToWidth: 0.4,
          highFreqToDepth: 0.2
        },
        amplitudeMapping: {
          sensitivity: 0.6,
          smoothing: 0.8
        },
        stylePreset: 'architectural',
        resolution: 32,
        symmetry: 'radial'
      }
    });

    // Load custom presets from localStorage
    this.loadCustomPresets();
  }

  /**
   * Set callback for parameter changes
   */
  onParameterChange(callback: ParameterChangeCallback): void {
    this.changeCallback = callback;
  }

  /**
   * Get current parameter values
   */
  getParameters(): SculptureParams {
    return { ...this.params };
  }

  /**
   * Update parameters programmatically
   */
  setParameters(params: Partial<SculptureParams>): void {
    // Deep merge parameters to handle nested objects
    if (params.frequencyMapping) {
      this.params.frequencyMapping = { ...this.params.frequencyMapping, ...params.frequencyMapping };
    }
    if (params.amplitudeMapping) {
      this.params.amplitudeMapping = { ...this.params.amplitudeMapping, ...params.amplitudeMapping };
    }
    if (params.stylePreset !== undefined) {
      this.params.stylePreset = params.stylePreset;
    }
    if (params.resolution !== undefined) {
      this.params.resolution = params.resolution;
    }
    if (params.symmetry !== undefined) {
      this.params.symmetry = params.symmetry;
    }
    
    // Validate parameters after setting
    this.validateParameters();
    this.updateControlValues();
  }

  /**
   * Create all parameter control elements
   */
  private createControls(): void {
    this.container.innerHTML = '';
    this.container.className = 'parameter-controls';

    // Create preset controls first
    this.createPresetControls();
    
    // Create frequency mapping controls
    this.createFrequencyMappingControls();
    
    // Create amplitude mapping controls
    this.createAmplitudeMappingControls();
    
    // Create style and resolution controls
    this.createStyleControls();
    
    // Create symmetry controls
    this.createSymmetryControls();
  }

  /**
   * Create preset controls section
   */
  private createPresetControls(): void {
    const section = this.createSection('Presets', 'preset-controls');
    
    // Preset selector dropdown
    const presetOptions = Array.from(this.presets.entries()).map(([key, preset]) => ({
      value: key,
      label: preset.name
    }));
    
    const presetSelector = this.createDropdown(
      'Select Preset',
      'preset_selector',
      '',
      [{ value: '', label: 'Choose a preset...' }, ...presetOptions],
      'Apply a predefined parameter configuration'
    );
    section.appendChild(presetSelector);
    
    // Preset action buttons container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'preset-buttons';
    
    // Apply preset button
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply Preset';
    applyButton.className = 'preset-button apply-button';
    applyButton.title = 'Apply the selected preset with smooth transition';
    applyButton.addEventListener('click', () => this.handleApplyPreset());
    buttonContainer.appendChild(applyButton);
    
    // Save as preset button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save as Preset';
    saveButton.className = 'preset-button save-button';
    saveButton.title = 'Save current parameters as a new preset';
    saveButton.addEventListener('click', () => this.handleSavePreset());
    buttonContainer.appendChild(saveButton);
    
    // Delete preset button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete Preset';
    deleteButton.className = 'preset-button delete-button';
    deleteButton.title = 'Delete the selected custom preset';
    deleteButton.addEventListener('click', () => this.handleDeletePreset());
    buttonContainer.appendChild(deleteButton);
    
    section.appendChild(buttonContainer);
    
    // Preset description display
    const descriptionContainer = document.createElement('div');
    descriptionContainer.className = 'preset-description';
    descriptionContainer.innerHTML = '<em>Select a preset to see its description</em>';
    section.appendChild(descriptionContainer);
    
    // Store references for later use
    this.controls.set('preset_selector', presetSelector.querySelector('select')!);
    this.controls.set('preset_description', descriptionContainer);
    this.controls.set('apply_button', applyButton);
    this.controls.set('delete_button', deleteButton);
    
    // Handle preset selector changes
    const selectElement = presetSelector.querySelector('select')!;
    selectElement.addEventListener('change', (e) => {
      const selectedPreset = (e.target as HTMLSelectElement).value;
      this.updatePresetDescription(selectedPreset);
      this.updatePresetButtons(selectedPreset);
    });
  }

  /**
   * Update preset description display
   */
  private updatePresetDescription(presetName: string): void {
    const descriptionElement = this.controls.get('preset_description') as HTMLElement;
    if (!descriptionElement) return;
    
    if (!presetName) {
      descriptionElement.innerHTML = '<em>Select a preset to see its description</em>';
      return;
    }
    
    const preset = this.presets.get(presetName);
    if (preset) {
      descriptionElement.innerHTML = `<strong>${preset.name}:</strong> ${preset.description}`;
    } else {
      descriptionElement.innerHTML = '<em>Preset not found</em>';
    }
  }

  /**
   * Update preset button states
   */
  private updatePresetButtons(presetName: string): void {
    const applyButton = this.controls.get('apply_button') as HTMLButtonElement;
    const deleteButton = this.controls.get('delete_button') as HTMLButtonElement;
    
    if (applyButton) {
      applyButton.disabled = !presetName || this.isTransitioning;
    }
    
    if (deleteButton) {
      const builtInPresets = ['organic', 'geometric', 'abstract', 'architectural'];
      deleteButton.disabled = !presetName || builtInPresets.includes(presetName);
    }
  }

  /**
   * Handle apply preset button click
   */
  private async handleApplyPreset(): Promise<void> {
    const selectorElement = this.controls.get('preset_selector') as HTMLSelectElement;
    const selectedPreset = selectorElement?.value;
    
    if (!selectedPreset) {
      alert('Please select a preset to apply');
      return;
    }
    
    // Apply with smooth transition
    const transition: PresetTransition = {
      duration: 1000, // 1 second transition
      easing: 'ease-in-out'
    };
    
    try {
      const success = await this.applyPreset(selectedPreset, transition);
      if (!success) {
        alert('Failed to apply preset');
      }
    } catch (error) {
      console.error('Error applying preset:', error);
      alert('Error applying preset');
    }
  }

  /**
   * Handle save preset button click
   */
  private handleSavePreset(): void {
    const name = prompt('Enter a name for this preset:');
    if (!name) return;
    
    const description = prompt('Enter a description for this preset (optional):') || '';
    
    const success = this.saveAsPreset(name, description);
    if (success) {
      // Refresh preset selector
      this.refreshPresetSelector();
      alert(`Preset "${name}" saved successfully!`);
    } else {
      alert('Failed to save preset. Please check the name and try again.');
    }
  }

  /**
   * Handle delete preset button click
   */
  private handleDeletePreset(): void {
    const selectorElement = this.controls.get('preset_selector') as HTMLSelectElement;
    const selectedPreset = selectorElement?.value;
    
    if (!selectedPreset) {
      alert('Please select a preset to delete');
      return;
    }
    
    const preset = this.presets.get(selectedPreset);
    if (!preset) {
      alert('Preset not found');
      return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete the preset "${preset.name}"?`);
    if (!confirmed) return;
    
    const success = this.deletePreset(selectedPreset);
    if (success) {
      // Refresh preset selector and clear selection
      this.refreshPresetSelector();
      selectorElement.value = '';
      this.updatePresetDescription('');
      this.updatePresetButtons('');
      alert(`Preset "${preset.name}" deleted successfully!`);
    } else {
      alert('Failed to delete preset');
    }
  }

  /**
   * Refresh the preset selector dropdown
   */
  private refreshPresetSelector(): void {
    const selectorElement = this.controls.get('preset_selector') as HTMLSelectElement;
    if (!selectorElement) return;
    
    // Clear existing options
    selectorElement.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choose a preset...';
    selectorElement.appendChild(defaultOption);
    
    // Add preset options
    for (const [key, preset] of this.presets.entries()) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = preset.name;
      selectorElement.appendChild(option);
    }
  }

  /**
   * Create frequency-to-dimension mapping controls
   */
  private createFrequencyMappingControls(): void {
    const section = this.createSection('Frequency Mapping', 'frequency-mapping');
    
    // Low frequency to height
    const lowFreqControl = this.createSlider(
      'Low Freq → Height',
      'frequencyMapping.lowFreqToHeight',
      this.params.frequencyMapping.lowFreqToHeight,
      0,
      1,
      0.01,
      'Controls how low frequencies (bass) affect sculpture height'
    );
    section.appendChild(lowFreqControl);
    
    // Mid frequency to width
    const midFreqControl = this.createSlider(
      'Mid Freq → Width',
      'frequencyMapping.midFreqToWidth',
      this.params.frequencyMapping.midFreqToWidth,
      0,
      1,
      0.01,
      'Controls how mid frequencies affect sculpture width'
    );
    section.appendChild(midFreqControl);
    
    // High frequency to depth
    const highFreqControl = this.createSlider(
      'High Freq → Depth',
      'frequencyMapping.highFreqToDepth',
      this.params.frequencyMapping.highFreqToDepth,
      0,
      1,
      0.01,
      'Controls how high frequencies (treble) affect sculpture depth'
    );
    section.appendChild(highFreqControl);
  }

  /**
   * Create amplitude mapping controls
   */
  private createAmplitudeMappingControls(): void {
    const section = this.createSection('Amplitude Mapping', 'amplitude-mapping');
    
    // Amplitude sensitivity
    const sensitivityControl = this.createSlider(
      'Amplitude Sensitivity',
      'amplitudeMapping.sensitivity',
      this.params.amplitudeMapping.sensitivity,
      0,
      2,
      0.01,
      'Controls how sensitive the sculpture is to volume changes'
    );
    section.appendChild(sensitivityControl);
    
    // Temporal smoothing
    const smoothingControl = this.createSlider(
      'Temporal Smoothing',
      'amplitudeMapping.smoothing',
      this.params.amplitudeMapping.smoothing,
      0,
      1,
      0.01,
      'Controls how smooth the transitions are over time'
    );
    section.appendChild(smoothingControl);
  }

  /**
   * Create style and resolution controls
   */
  private createStyleControls(): void {
    const section = this.createSection('Style & Quality', 'style-controls');
    
    // Style preset dropdown
    const styleControl = this.createDropdown(
      'Style Preset',
      'stylePreset',
      this.params.stylePreset,
      [
        { value: 'organic', label: 'Organic' },
        { value: 'geometric', label: 'Geometric' },
        { value: 'abstract', label: 'Abstract' },
        { value: 'architectural', label: 'Architectural' }
      ],
      'Choose the overall aesthetic style of the sculpture'
    );
    section.appendChild(styleControl);
    
    // Resolution slider
    const resolutionControl = this.createSlider(
      'Mesh Resolution',
      'resolution',
      this.params.resolution,
      16,
      128,
      4,
      'Controls the detail level of the 3D mesh (higher = more detailed)'
    );
    section.appendChild(resolutionControl);
  }

  /**
   * Create symmetry controls
   */
  private createSymmetryControls(): void {
    const section = this.createSection('Symmetry', 'symmetry-controls');
    
    const symmetryControl = this.createDropdown(
      'Symmetry Type',
      'symmetry',
      this.params.symmetry,
      [
        { value: 'none', label: 'None' },
        { value: 'radial', label: 'Radial' },
        { value: 'bilateral', label: 'Bilateral' }
      ],
      'Apply symmetry to the sculpture'
    );
    section.appendChild(symmetryControl);
  }

  /**
   * Create a control section with title
   */
  private createSection(title: string, className: string): HTMLElement {
    const section = document.createElement('div');
    section.className = `control-section ${className}`;
    
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.className = 'section-title';
    section.appendChild(titleElement);
    
    this.container.appendChild(section);
    return section;
  }

  /**
   * Create a slider control
   */
  private createSlider(
    label: string,
    paramPath: string,
    value: number,
    min: number,
    max: number,
    step: number,
    tooltip: string
  ): HTMLElement {
    const controlGroup = document.createElement('div');
    controlGroup.className = 'control-group slider-control';
    controlGroup.title = tooltip;
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'control-label';
    
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'value-display';
    valueDisplay.textContent = value.toFixed(2);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min.toString();
    slider.max = max.toString();
    slider.step = step.toString();
    slider.value = value.toString();
    slider.className = 'parameter-slider';
    
    // Handle slider changes
    slider.addEventListener('input', (e) => {
      const newValue = parseFloat((e.target as HTMLInputElement).value);
      valueDisplay.textContent = newValue.toFixed(2);
      this.updateParameter(paramPath, newValue);
    });
    
    controlGroup.appendChild(labelElement);
    controlGroup.appendChild(valueDisplay);
    controlGroup.appendChild(slider);
    
    this.controls.set(paramPath, slider);
    return controlGroup;
  }

  /**
   * Create a dropdown control
   */
  private createDropdown(
    label: string,
    paramPath: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    tooltip: string
  ): HTMLElement {
    const controlGroup = document.createElement('div');
    controlGroup.className = 'control-group dropdown-control';
    controlGroup.title = tooltip;
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'control-label';
    
    const select = document.createElement('select');
    select.className = 'parameter-dropdown';
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      optionElement.selected = option.value === value;
      select.appendChild(optionElement);
    });
    
    // Handle dropdown changes
    select.addEventListener('change', (e) => {
      const newValue = (e.target as HTMLSelectElement).value;
      this.updateParameter(paramPath, newValue);
    });
    
    controlGroup.appendChild(labelElement);
    controlGroup.appendChild(select);
    
    this.controls.set(paramPath, select);
    return controlGroup;
  }

  /**
   * Update a parameter value and trigger callback
   */
  private updateParameter(paramPath: string, value: any): void {
    // Update the parameter in the params object
    if (paramPath.includes('.')) {
      // Handle nested parameters (e.g., 'frequencyMapping.lowFreqToHeight')
      const [parent, child] = paramPath.split('.');
      if (parent === 'frequencyMapping') {
        (this.params.frequencyMapping as any)[child] = value;
      } else if (parent === 'amplitudeMapping') {
        (this.params.amplitudeMapping as any)[child] = value;
      }
    } else {
      // Handle top-level parameters
      (this.params as any)[paramPath] = value;
    }

    // Validate parameters
    this.validateParameters();

    // Trigger callback
    if (this.changeCallback) {
      this.changeCallback({
        parameter: paramPath,
        value: this.getParameterValue(paramPath), // Use validated value
        params: { ...this.params }
      });
    }
  }

  /**
   * Get parameter value by path
   */
  private getParameterValue(paramPath: string): any {
    if (paramPath.includes('.')) {
      const [parent, child] = paramPath.split('.');
      if (parent === 'frequencyMapping') {
        return (this.params.frequencyMapping as any)[child];
      } else if (parent === 'amplitudeMapping') {
        return (this.params.amplitudeMapping as any)[child];
      }
    } else {
      return (this.params as any)[paramPath];
    }
  }

  /**
   * Update control values to match current parameters
   */
  private updateControlValues(): void {
    // Update frequency mapping controls
    this.updateControlValue('frequencyMapping.lowFreqToHeight', this.params.frequencyMapping.lowFreqToHeight);
    this.updateControlValue('frequencyMapping.midFreqToWidth', this.params.frequencyMapping.midFreqToWidth);
    this.updateControlValue('frequencyMapping.highFreqToDepth', this.params.frequencyMapping.highFreqToDepth);
    
    // Update amplitude mapping controls
    this.updateControlValue('amplitudeMapping.sensitivity', this.params.amplitudeMapping.sensitivity);
    this.updateControlValue('amplitudeMapping.smoothing', this.params.amplitudeMapping.smoothing);
    
    // Update style controls
    this.updateControlValue('stylePreset', this.params.stylePreset);
    this.updateControlValue('resolution', this.params.resolution);
    this.updateControlValue('symmetry', this.params.symmetry);
  }

  /**
   * Update a specific control value
   */
  private updateControlValue(paramPath: string, value: any): void {
    const control = this.controls.get(paramPath);
    if (control) {
      if (control instanceof HTMLInputElement) {
        control.value = value.toString();
        // Update value display for sliders
        const valueDisplay = control.parentElement?.querySelector('.value-display');
        if (valueDisplay && typeof value === 'number') {
          valueDisplay.textContent = value.toFixed(2);
        }
      } else if (control instanceof HTMLSelectElement) {
        control.value = value;
      }
    }
  }

  /**
   * Validate parameter values and enforce bounds
   */
  private validateParameters(): void {
    // Validate frequency mapping (0-1 range)
    this.params.frequencyMapping.lowFreqToHeight = this.clamp(this.params.frequencyMapping.lowFreqToHeight, 0, 1);
    this.params.frequencyMapping.midFreqToWidth = this.clamp(this.params.frequencyMapping.midFreqToWidth, 0, 1);
    this.params.frequencyMapping.highFreqToDepth = this.clamp(this.params.frequencyMapping.highFreqToDepth, 0, 1);
    
    // Validate amplitude mapping
    this.params.amplitudeMapping.sensitivity = this.clamp(this.params.amplitudeMapping.sensitivity, 0, 2);
    this.params.amplitudeMapping.smoothing = this.clamp(this.params.amplitudeMapping.smoothing, 0, 1);
    
    // Validate resolution
    this.params.resolution = Math.max(16, Math.min(128, Math.round(this.params.resolution)));
    
    // Validate style preset
    const validPresets: SculptureParams['stylePreset'][] = ['organic', 'geometric', 'abstract', 'architectural'];
    if (!validPresets.includes(this.params.stylePreset)) {
      this.params.stylePreset = 'organic';
    }
    
    // Validate symmetry
    const validSymmetry: SculptureParams['symmetry'][] = ['none', 'radial', 'bilateral'];
    if (!validSymmetry.includes(this.params.symmetry)) {
      this.params.symmetry = 'none';
    }
  }

  /**
   * Clamp a value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Reset parameters to default values
   */
  resetToDefaults(): void {
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
    
    this.setParameters(defaultParams);
    
    if (this.changeCallback) {
      this.changeCallback({
        parameter: 'reset',
        value: defaultParams,
        params: defaultParams
      });
    }
  }

  /**
   * Export current parameters as JSON
   */
  exportParameters(): string {
    return JSON.stringify(this.params, null, 2);
  }

  /**
   * Import parameters from JSON
   */
  importParameters(jsonString: string): boolean {
    try {
      const importedParams = JSON.parse(jsonString);
      
      // Validate imported parameters structure
      if (this.isValidParameterStructure(importedParams)) {
        this.setParameters(importedParams);
        return true;
      } else {
        console.error('Invalid parameter structure in imported JSON');
        return false;
      }
    } catch (error) {
      console.error('Failed to parse parameter JSON:', error);
      return false;
    }
  }

  /**
   * Validate parameter structure
   */
  private isValidParameterStructure(params: any): params is SculptureParams {
    return (
      params &&
      typeof params === 'object' &&
      params.frequencyMapping &&
      typeof params.frequencyMapping.lowFreqToHeight === 'number' &&
      typeof params.frequencyMapping.midFreqToWidth === 'number' &&
      typeof params.frequencyMapping.highFreqToDepth === 'number' &&
      params.amplitudeMapping &&
      typeof params.amplitudeMapping.sensitivity === 'number' &&
      typeof params.amplitudeMapping.smoothing === 'number' &&
      typeof params.stylePreset === 'string' &&
      typeof params.resolution === 'number' &&
      typeof params.symmetry === 'string'
    );
  }

  /**
   * Load custom presets from localStorage
   */
  private loadCustomPresets(): void {
    try {
      const customPresetsJson = localStorage.getItem('soundWaveSculptor_customPresets');
      if (customPresetsJson) {
        const customPresets = JSON.parse(customPresetsJson);
        for (const [key, preset] of Object.entries(customPresets)) {
          if (this.isValidPresetProfile(preset)) {
            this.presets.set(key, preset as PresetProfile);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load custom presets:', error);
    }
  }

  /**
   * Save custom presets to localStorage
   */
  private saveCustomPresets(): void {
    try {
      const customPresets: Record<string, PresetProfile> = {};
      
      // Only save custom presets (not built-in ones)
      const builtInPresets = ['organic', 'geometric', 'abstract', 'architectural'];
      for (const [key, preset] of this.presets.entries()) {
        if (!builtInPresets.includes(key)) {
          customPresets[key] = preset;
        }
      }
      
      localStorage.setItem('soundWaveSculptor_customPresets', JSON.stringify(customPresets));
    } catch (error) {
      console.error('Failed to save custom presets:', error);
    }
  }

  /**
   * Validate preset profile structure
   */
  private isValidPresetProfile(preset: any): preset is PresetProfile {
    return (
      preset &&
      typeof preset === 'object' &&
      typeof preset.name === 'string' &&
      typeof preset.description === 'string' &&
      preset.parameters &&
      this.isValidParameterStructure(preset.parameters)
    );
  }

  /**
   * Get all available presets
   */
  getPresets(): PresetProfile[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get preset by name
   */
  getPreset(name: string): PresetProfile | undefined {
    return this.presets.get(name);
  }

  /**
   * Apply a preset with smooth transition
   */
  async applyPreset(presetName: string, transition?: PresetTransition): Promise<boolean> {
    const preset = this.presets.get(presetName);
    if (!preset) {
      console.error(`Preset '${presetName}' not found`);
      return false;
    }

    if (this.isTransitioning) {
      console.warn('Transition already in progress, ignoring new preset application');
      return false;
    }

    if (transition && transition.duration > 0) {
      return this.applyPresetWithTransition(preset, transition);
    } else {
      // Apply immediately without transition
      this.setParameters(preset.parameters);
      
      // Trigger callback for immediate preset application
      if (this.changeCallback) {
        this.changeCallback({
          parameter: 'preset_applied',
          value: preset.name,
          params: { ...this.params }
        });
      }
      
      return true;
    }
  }

  /**
   * Apply preset with smooth transition animation
   */
  private async applyPresetWithTransition(preset: PresetProfile, transition: PresetTransition): Promise<boolean> {
    this.isTransitioning = true;
    
    const startParams = { ...this.params };
    const targetParams = preset.parameters;
    const duration = transition.duration;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Apply easing function
        const easedProgress = this.applyEasing(progress, transition.easing);
        
        // Interpolate parameters
        const interpolatedParams = this.interpolateParameters(startParams, targetParams, easedProgress);
        
        // Update parameters without triggering validation callback to avoid excessive updates
        this.params = interpolatedParams;
        this.updateControlValues();
        
        // Trigger callback with interpolated values
        if (this.changeCallback) {
          this.changeCallback({
            parameter: 'preset_transition',
            value: preset.name,
            params: { ...interpolatedParams }
          });
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure final values are exactly the target values
          this.setParameters(targetParams);
          this.isTransitioning = false;
          resolve(true);
        }
      };
      
      requestAnimationFrame(animate);
    });
  }

  /**
   * Apply easing function to progress value
   */
  private applyEasing(progress: number, easing: PresetTransition['easing']): number {
    switch (easing) {
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - (1 - progress) * (1 - progress);
      case 'ease-in-out':
        return progress < 0.5 
          ? 2 * progress * progress 
          : 1 - 2 * (1 - progress) * (1 - progress);
      case 'linear':
      default:
        return progress;
    }
  }

  /**
   * Interpolate between two parameter sets
   */
  private interpolateParameters(start: SculptureParams, target: SculptureParams, progress: number): SculptureParams {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    
    return {
      frequencyMapping: {
        lowFreqToHeight: lerp(start.frequencyMapping.lowFreqToHeight, target.frequencyMapping.lowFreqToHeight, progress),
        midFreqToWidth: lerp(start.frequencyMapping.midFreqToWidth, target.frequencyMapping.midFreqToWidth, progress),
        highFreqToDepth: lerp(start.frequencyMapping.highFreqToDepth, target.frequencyMapping.highFreqToDepth, progress)
      },
      amplitudeMapping: {
        sensitivity: lerp(start.amplitudeMapping.sensitivity, target.amplitudeMapping.sensitivity, progress),
        smoothing: lerp(start.amplitudeMapping.smoothing, target.amplitudeMapping.smoothing, progress)
      },
      stylePreset: progress < 0.5 ? start.stylePreset : target.stylePreset,
      resolution: Math.round(lerp(start.resolution, target.resolution, progress)),
      symmetry: progress < 0.5 ? start.symmetry : target.symmetry
    };
  }

  /**
   * Save current parameters as a custom preset
   */
  saveAsPreset(name: string, description: string): boolean {
    if (!name.trim()) {
      console.error('Preset name cannot be empty');
      return false;
    }

    // Check if name conflicts with built-in presets
    const builtInPresets = ['organic', 'geometric', 'abstract', 'architectural'];
    if (builtInPresets.includes(name.toLowerCase())) {
      console.error('Cannot overwrite built-in presets');
      return false;
    }

    const preset: PresetProfile = {
      name: name.trim(),
      description: description.trim() || 'Custom preset',
      parameters: { ...this.params }
    };

    this.presets.set(name, preset);
    this.saveCustomPresets();
    return true;
  }

  /**
   * Delete a custom preset
   */
  deletePreset(name: string): boolean {
    // Prevent deletion of built-in presets
    const builtInPresets = ['organic', 'geometric', 'abstract', 'architectural'];
    if (builtInPresets.includes(name)) {
      console.error('Cannot delete built-in presets');
      return false;
    }

    if (this.presets.has(name)) {
      this.presets.delete(name);
      this.saveCustomPresets();
      return true;
    }

    return false;
  }

  /**
   * Check if currently transitioning between presets
   */
  isTransitionInProgress(): boolean {
    return this.isTransitioning;
  }

  /**
   * Export preset as JSON string
   */
  exportPreset(presetName: string): string | null {
    const preset = this.presets.get(presetName);
    if (!preset) {
      return null;
    }
    return JSON.stringify(preset, null, 2);
  }

  /**
   * Import preset from JSON string
   */
  importPreset(jsonString: string, customName?: string): boolean {
    try {
      const preset = JSON.parse(jsonString);
      
      if (!this.isValidPresetProfile(preset)) {
        console.error('Invalid preset structure');
        return false;
      }

      const presetName = customName || preset.name;
      
      // Check if name conflicts with built-in presets
      const builtInPresets = ['organic', 'geometric', 'abstract', 'architectural'];
      if (builtInPresets.includes(presetName.toLowerCase())) {
        console.error('Cannot overwrite built-in presets');
        return false;
      }

      this.presets.set(presetName, {
        ...preset,
        name: presetName
      });
      
      this.saveCustomPresets();
      return true;
    } catch (error) {
      console.error('Failed to import preset:', error);
      return false;
    }
  }
}