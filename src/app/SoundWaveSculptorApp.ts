import { AudioController, AudioFileInfo } from "../audio/AudioController";
import { AudioProcessor, AudioFeatures } from "../audio/AudioProcessor";
import { MeshGenerator } from "../mesh/MeshGenerator";
import { VisualizationEngine } from "../visualization/VisualizationEngine";
import {
  ParameterControls,
  ParameterChangeEvent,
} from "../controls/ParameterControls";
import { ExportManager } from "../export/ExportManager";
import { StorageManager } from "../storage/StorageManager";
import { ProgressTracker } from "../errors/ProgressTracker";
import { globalErrorHandler } from "../errors/ErrorHandler";
import { SculptureParams, Mesh3D } from "../types";

export class SoundWaveSculptorApp {
  private container: HTMLElement;
  private audioController: AudioController;
  private audioProcessor: AudioProcessor;
  private meshGenerator: MeshGenerator;
  private visualizationEngine: VisualizationEngine | null = null;
  private parameterControls: ParameterControls | null = null;
  private exportManager: ExportManager;
  private storageManager: StorageManager;
  private progressTracker: ProgressTracker;

  // UI Elements
  private fileInput: HTMLInputElement | null = null;
  private playButton: HTMLButtonElement | null = null;
  private pauseButton: HTMLButtonElement | null = null;
  private stopButton: HTMLButtonElement | null = null;
  private liveRecordButton: HTMLButtonElement | null = null;
  private generateButton: HTMLButtonElement | null = null;
  private exportButton: HTMLButtonElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private timeSlider: HTMLInputElement | null = null;
  private timeDisplay: HTMLElement | null = null;
  private statusDisplay: HTMLElement | null = null;

  // State
  private currentAudioFeatures: AudioFeatures | null = null;
  private currentMesh: Mesh3D | null = null;
  private currentParams: SculptureParams;
  private isRecording: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;

    // Initialize core components
    this.audioController = new AudioController();
    this.audioProcessor = new AudioProcessor();
    this.meshGenerator = new MeshGenerator();
    this.exportManager = new ExportManager();
    this.storageManager = new StorageManager();
    this.progressTracker = new ProgressTracker(
      "sculpture-generation",
      "Generating Sound Wave Sculpture",
      [
        {
          id: "mesh-generation",
          name: "Mesh Generation",
          description: "Generating 3D mesh from audio data",
          weight: 1,
        },
      ]
    );

    // Default parameters
    this.currentParams = {
      frequencyMapping: {
        lowFreqToHeight: 0.7,
        midFreqToWidth: 0.5,
        highFreqToDepth: 0.3,
      },
      amplitudeMapping: {
        sensitivity: 1.0,
        smoothing: 0.5,
      },
      stylePreset: "organic",
      resolution: 64,
      symmetry: "none",
    };
  }

  public async initialize(): Promise<void> {
    try {
      this.createUI();
      this.setupEventListeners();
      this.updateStatus("Ready - Upload an audio file or start live recording");

      // Initialize storage manager
      await this.storageManager.initialize();

      console.log("Sound Wave Sculptor initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Sound Wave Sculptor:", error);
      this.updateStatus("Failed to initialize application");
    }
  }

  private createUI(): void {
    this.container.innerHTML = "";
    this.container.className = "sound-wave-sculptor-app";

    // Create main layout
    const mainLayout = document.createElement("div");
    mainLayout.className = "main-layout";

    // Create header
    const header = this.createHeader();
    mainLayout.appendChild(header);

    // Create content area with two panels
    const contentArea = document.createElement("div");
    contentArea.className = "content-area";

    // Left panel - Controls
    const leftPanel = document.createElement("div");
    leftPanel.className = "left-panel";

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "controls-container";
    leftPanel.appendChild(controlsContainer);

    // Right panel - Visualization
    const rightPanel = document.createElement("div");
    rightPanel.className = "right-panel";

    const visualizationContainer = document.createElement("div");
    visualizationContainer.className = "visualization-container";
    visualizationContainer.id = "visualization-container";
    rightPanel.appendChild(visualizationContainer);

    contentArea.appendChild(leftPanel);
    contentArea.appendChild(rightPanel);
    mainLayout.appendChild(contentArea);

    // Create footer with status
    const footer = this.createFooter();
    mainLayout.appendChild(footer);

    this.container.appendChild(mainLayout);

    // Initialize components that need DOM elements
    this.initializeVisualization(visualizationContainer);
    this.initializeParameterControls(controlsContainer);
  }

  private createHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "app-header";

    // Title
    const title = document.createElement("h1");
    title.textContent = "Sound Wave Sculptor";
    title.className = "app-title";
    header.appendChild(title);

    // Audio controls section
    const audioControls = document.createElement("div");
    audioControls.className = "audio-controls";

    // Input controls section
    const inputControls = document.createElement("div");
    inputControls.className = "input-controls";

    // File input
    const fileInputContainer = document.createElement("div");
    fileInputContainer.className = "file-input-container";

    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = "audio/*";
    this.fileInput.className = "file-input";
    this.fileInput.id = "audio-file-input";

    const fileLabel = document.createElement("label");
    fileLabel.textContent = "📁 Choose Audio File";
    fileLabel.className = "file-label";
    fileLabel.htmlFor = "audio-file-input";

    fileInputContainer.appendChild(this.fileInput);
    fileInputContainer.appendChild(fileLabel);
    inputControls.appendChild(fileInputContainer);

    // Live recording button
    this.liveRecordButton = document.createElement("button");
    this.liveRecordButton.textContent = "🎤 Record Live";
    this.liveRecordButton.className = "control-button record-button";
    this.liveRecordButton.title = "Record live audio from microphone";
    this.liveRecordButton.type = "button"; // Explicitly set button type
    inputControls.appendChild(this.liveRecordButton);

    audioControls.appendChild(inputControls);

    // Playback controls
    const playbackControls = document.createElement("div");
    playbackControls.className = "playback-controls";

    this.playButton = document.createElement("button");
    this.playButton.textContent = "▶️ Play";
    this.playButton.className = "control-button play-button";
    this.playButton.disabled = true;

    this.pauseButton = document.createElement("button");
    this.pauseButton.textContent = "⏸️ Pause";
    this.pauseButton.className = "control-button pause-button";
    this.pauseButton.disabled = true;

    this.stopButton = document.createElement("button");
    this.stopButton.textContent = "⏹️ Stop";
    this.stopButton.className = "control-button stop-button";
    this.stopButton.disabled = true;

    playbackControls.appendChild(this.playButton);
    playbackControls.appendChild(this.pauseButton);
    playbackControls.appendChild(this.stopButton);
    audioControls.appendChild(playbackControls);

    // Time controls
    const timeControls = document.createElement("div");
    timeControls.className = "time-controls";

    this.timeDisplay = document.createElement("div");
    this.timeDisplay.className = "time-display";
    this.timeDisplay.textContent = "00:00 / 00:00";

    this.timeSlider = document.createElement("input");
    this.timeSlider.type = "range";
    this.timeSlider.min = "0";
    this.timeSlider.max = "100";
    this.timeSlider.value = "0";
    this.timeSlider.className = "time-slider";
    this.timeSlider.disabled = true;

    timeControls.appendChild(this.timeDisplay);
    timeControls.appendChild(this.timeSlider);
    audioControls.appendChild(timeControls);

    header.appendChild(audioControls);

    // Action buttons
    const actionButtons = document.createElement("div");
    actionButtons.className = "action-buttons";

    this.generateButton = document.createElement("button");
    this.generateButton.textContent = "🎨 Generate Sculpture";
    this.generateButton.className = "control-button generate-button primary";
    this.generateButton.disabled = true;

    this.exportButton = document.createElement("button");
    this.exportButton.textContent = "💾 Export 3D Model";
    this.exportButton.className = "control-button export-button";
    this.exportButton.disabled = true;

    this.saveButton = document.createElement("button");
    this.saveButton.textContent = "📁 Save Sculpture";
    this.saveButton.className = "control-button save-button";
    this.saveButton.disabled = true;

    actionButtons.appendChild(this.generateButton);
    actionButtons.appendChild(this.exportButton);
    actionButtons.appendChild(this.saveButton);
    header.appendChild(actionButtons);

    return header;
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement("footer");
    footer.className = "app-footer";

    this.statusDisplay = document.createElement("div");
    this.statusDisplay.className = "status-display";
    this.statusDisplay.textContent = "Initializing...";

    footer.appendChild(this.statusDisplay);
    return footer;
  }

  private initializeVisualization(container: HTMLElement): void {
    this.visualizationEngine = new VisualizationEngine(container);
  }

  private initializeParameterControls(container: HTMLElement): void {
    this.parameterControls = new ParameterControls(
      container,
      this.currentParams
    );
    this.parameterControls.onParameterChange((event: ParameterChangeEvent) => {
      this.currentParams = event.params;
      this.onParametersChanged();
    });
  }

  private setupEventListeners(): void {
    // File input
    if (this.fileInput) {
      this.fileInput.addEventListener("change", (e) => {
        e.stopPropagation();
        this.handleFileSelect(e);
      });
    }

    // Playback controls
    if (this.playButton) {
      this.playButton.addEventListener("click", () => this.handlePlay());
    }
    if (this.pauseButton) {
      this.pauseButton.addEventListener("click", () => this.handlePause());
    }
    if (this.stopButton) {
      this.stopButton.addEventListener("click", () => this.handleStop());
    }

    // Live recording
    if (this.liveRecordButton) {
      this.liveRecordButton.addEventListener("click", () =>
        this.handleLiveRecord()
      );
    }

    // Action buttons
    if (this.generateButton) {
      this.generateButton.addEventListener("click", () =>
        this.handleGenerate()
      );
    }
    if (this.exportButton) {
      this.exportButton.addEventListener("click", () => this.handleExport());
    }
    if (this.saveButton) {
      this.saveButton.addEventListener("click", () => this.handleSave());
    }

    // Time slider
    if (this.timeSlider) {
      this.timeSlider.addEventListener("input", (e) => this.handleTimeSeek(e));
    }

    // Window resize
    window.addEventListener("resize", () => this.handleResize());
  }

  private async handleFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      this.updateStatus("Loading audio file...");

      const fileInfo: AudioFileInfo = await this.audioController.loadAudioFile(
        file
      );

      this.updateStatus(
        `Loaded: ${fileInfo.name} (${this.formatDuration(fileInfo.duration)})`
      );

      // Enable playback controls
      this.enablePlaybackControls(true);

      // Enable generate button
      if (this.generateButton) {
        this.generateButton.disabled = false;
      }

      // Process audio for features
      await this.processAudioFeatures();
    } catch (error) {
      console.error("Error loading audio file:", error);
      this.updateStatus(
        `Error loading file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      globalErrorHandler.handleError(
        error instanceof Error ? error : new Error("Unknown error")
      );
    }
  }

  private async processAudioFeatures(): Promise<void> {
    const audioBuffer = this.audioController.getAudioBuffer();
    if (!audioBuffer) return;

    try {
      this.updateStatus("Analyzing audio...");

      // Get temporal features which includes all the audio analysis
      const temporalFeatures = await this.audioProcessor.getTemporalFeatures(
        audioBuffer
      );

      // Extract amplitude envelope
      const amplitudeData =
        this.audioProcessor.extractAmplitudeEnvelope(audioBuffer);

      // Combine all features
      this.currentAudioFeatures = {
        ...temporalFeatures,
        amplitudeEnvelope: amplitudeData.envelope,
      } as AudioFeatures;

      // Set up visualization with audio features
      if (this.visualizationEngine) {
        this.visualizationEngine.setAudioFeatures(this.currentAudioFeatures);
      }

      this.updateStatus(
        "Audio analysis complete - Ready to generate sculpture"
      );
    } catch (error) {
      console.error("Error processing audio features:", error);
      this.updateStatus("Error analyzing audio");
    }
  }

  private async handlePlay(): Promise<void> {
    try {
      await this.audioController.playAudio((currentTime: number) => {
        this.updateTimeDisplay(currentTime);

        // Update visualization if available
        if (this.visualizationEngine && this.currentAudioFeatures) {
          // Create mock processed frame for real-time visualization
          const frameIndex = Math.floor(currentTime * 60); // Assuming 60fps
          if (frameIndex < this.currentAudioFeatures.frequencyData.length) {
            const mockFrame = {
              frequencyData: {
                frequencies:
                  this.currentAudioFeatures.frequencyData[frameIndex] ||
                  new Float32Array(),
                magnitudes:
                  this.currentAudioFeatures.frequencyData[frameIndex] ||
                  new Float32Array(),
                phases: new Float32Array(),
                timestamp: currentTime,
              },
              amplitudeData: {
                envelope: this.currentAudioFeatures.amplitudeEnvelope,
                peaks: [],
                rms: new Float32Array(),
              },
              timestamp: currentTime,
            };

            this.visualizationEngine.updateRealTime(mockFrame);
          }
        }
      });

      this.updatePlaybackButtons(true);
    } catch (error) {
      console.error("Error playing audio:", error);
      this.updateStatus("Error playing audio");
    }
  }

  private handlePause(): void {
    this.audioController.pauseAudio();
    this.updatePlaybackButtons(false);
  }

  private handleStop(): void {
    this.audioController.stopAudio();
    this.updatePlaybackButtons(false);
    this.updateTimeDisplay(0);
  }

  private async handleTimeSeek(event: Event): Promise<void> {
    const slider = event.target as HTMLInputElement;
    const audioBuffer = this.audioController.getAudioBuffer();

    if (!audioBuffer) return;

    const seekTime = (parseFloat(slider.value) / 100) * audioBuffer.duration;

    try {
      await this.audioController.seekTo(seekTime);
      this.updateTimeDisplay(seekTime);
    } catch (error) {
      console.error("Error seeking audio:", error);
    }
  }

  private async handleLiveRecord(): Promise<void> {
    if (this.isRecording) {
      // Stop recording
      console.log("Stopping recording...");
      this.audioController.stopLiveCapture();
      this.isRecording = false;
      this.updateRecordingButton(false);
      this.updateStatus("Stopping recording...");
      return;
    }

    if (!this.audioController.isLiveCaptureSupported()) {
      this.updateStatus("Live audio capture is not supported in this browser");
      return;
    }

    try {
      this.isRecording = true;
      this.updateRecordingButton(true);
      this.updateStatus("Requesting microphone access...");

      const duration = 30; // 30 seconds default

      const audioBuffer = await this.audioController.startLiveCapture(
        duration,
        (state) => {
          // Update recording state
          console.log("Recording state:", state);
          if (state.isRecording) {
            this.updateStatus(
              `Recording... ${Math.floor(state.currentDuration)}s / ${
                state.maxDuration
              }s`
            );
          } else if (state.isPaused) {
            this.updateStatus("Recording paused");
          }
        },
        (levelData) => {
          // Update audio level display (could add visual feedback here)
          console.log("Audio level:", levelData.rms.toFixed(3));
        },
        (error) => {
          console.error("Recording error:", error);
          this.updateStatus(`Recording error: ${error.message}`);
          this.isRecording = false;
          this.updateRecordingButton(false);
        }
      );

      // Recording completed successfully
      this.isRecording = false;
      this.updateRecordingButton(false);
      this.updateStatus("Recording complete - Processing audio...");

      // Enable controls
      this.enablePlaybackControls(true);
      if (this.generateButton) {
        this.generateButton.disabled = false;
      }

      // Process the recorded audio
      await this.processAudioFeatures();
      
      this.updateStatus("Live audio processed - Ready to generate sculpture!");
    } catch (error) {
      this.isRecording = false;
      this.updateRecordingButton(false);
      console.error("Error during live recording:", error);
      this.updateStatus(
        `Recording failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async handleGenerate(): Promise<void> {
    if (!this.currentAudioFeatures) {
      this.updateStatus(
        "No audio loaded - please upload a file or record live audio"
      );
      return;
    }

    try {
      this.updateStatus("Generating 3D sculpture...");

      // Set up progress tracking
      this.progressTracker.startStep("mesh-generation");

      this.currentMesh = this.meshGenerator.generateFromAudio(
        this.currentAudioFeatures,
        this.currentParams
      );

      this.progressTracker.completeStep("mesh-generation");

      // Render the mesh
      if (this.visualizationEngine) {
        this.visualizationEngine.renderMesh(this.currentMesh);

        // Set up audio animation if we have audio loaded
        const audioBuffer = this.audioController.getAudioBuffer();
        if (audioBuffer) {
          this.visualizationEngine.animateWithAudio(
            audioBuffer,
            this.currentMesh
          );
        }
      }

      // Enable export and save buttons
      if (this.exportButton) {
        this.exportButton.disabled = false;
      }
      if (this.saveButton) {
        this.saveButton.disabled = false;
      }

      this.updateStatus(
        "Sculpture generated successfully! Use controls to adjust parameters."
      );
    } catch (error) {
      console.error("Error generating sculpture:", error);
      this.updateStatus(
        `Generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      globalErrorHandler.handleError(
        error instanceof Error ? error : new Error("Unknown error")
      );
    }
  }

  private async handleExport(): Promise<void> {
    if (!this.currentMesh) {
      this.updateStatus("No sculpture to export - generate one first");
      return;
    }

    try {
      this.updateStatus("Exporting 3D model...");

      // Show export options (for now, default to STL)
      const format = "stl"; // Could add UI to choose format
      const scale = 1.0; // Could add UI to set scale

      const blob =
        format === "stl"
          ? this.exportManager.exportSTL(this.currentMesh, scale)
          : this.exportManager.exportOBJ(this.currentMesh, scale).obj;

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sound-sculpture-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.updateStatus("3D model exported successfully!");
    } catch (error) {
      console.error("Error exporting sculpture:", error);
      this.updateStatus(
        `Export failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.currentMesh || !this.currentAudioFeatures) {
      this.updateStatus("No sculpture to save - generate one first");
      return;
    }

    try {
      const name = prompt("Enter a name for this sculpture:");
      if (!name) return;

      const description = prompt("Enter a description (optional):") || "";

      this.updateStatus("Saving sculpture...");

      const sculptureId = await this.storageManager.saveSculpture({
        metadata: {
          id: `sculpture-${Date.now()}`,
          name,
          description,
          createdAt: new Date(),
          audioFileName: "recorded-audio", // Could get actual filename if from file
          parameters: this.currentParams,
        },
        mesh: this.currentMesh,
        audioFeatures: this.currentAudioFeatures,
      });

      this.updateStatus(`Sculpture "${name}" saved successfully!`);
      console.log("Sculpture saved with ID:", sculptureId);
    } catch (error) {
      console.error("Error saving sculpture:", error);
      this.updateStatus(
        `Save failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private onParametersChanged(): void {
    // If we have audio features, regenerate the mesh with new parameters
    if (
      this.currentAudioFeatures &&
      this.generateButton &&
      !this.generateButton.disabled
    ) {
      // Auto-regenerate for real-time preview (debounced)
      this.debounceRegenerate();
    }
  }

  private debounceTimer: number | null = null;
  private debounceRegenerate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.handleGenerate();
    }, 500); // 500ms debounce
  }

  private updateStatus(message: string): void {
    if (this.statusDisplay) {
      this.statusDisplay.textContent = message;
    }
    console.log("Status:", message);
  }

  private updateTimeDisplay(currentTime: number): void {
    const audioBuffer = this.audioController.getAudioBuffer();
    const duration = audioBuffer?.duration || 0;

    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${this.formatTime(
        currentTime
      )} / ${this.formatTime(duration)}`;
    }

    if (this.timeSlider && duration > 0) {
      this.timeSlider.value = ((currentTime / duration) * 100).toString();
    }
  }

  private updatePlaybackButtons(isPlaying: boolean): void {
    if (this.playButton) {
      this.playButton.disabled = isPlaying;
    }
    if (this.pauseButton) {
      this.pauseButton.disabled = !isPlaying;
    }
    if (this.stopButton) {
      this.stopButton.disabled = !isPlaying;
    }
  }

  private updateRecordingButton(isRecording: boolean): void {
    if (this.liveRecordButton) {
      this.liveRecordButton.textContent = isRecording
        ? "⏹️ Stop Recording"
        : "🎤 Record Live";
      this.liveRecordButton.className = isRecording
        ? "control-button record-button recording"
        : "control-button record-button";
    }
  }

  private enablePlaybackControls(enabled: boolean): void {
    if (this.playButton) {
      this.playButton.disabled = !enabled;
    }
    if (this.timeSlider) {
      this.timeSlider.disabled = !enabled;
    }
  }

  private handleResize(): void {
    if (this.visualizationEngine) {
      const container = document.getElementById("visualization-container");
      if (container) {
        this.visualizationEngine.resize(
          container.clientWidth,
          container.clientHeight
        );
      }
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  public dispose(): void {
    // Clean up resources
    this.audioController.dispose();
    if (this.visualizationEngine) {
      this.visualizationEngine.dispose();
    }

    // Clear any pending timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
