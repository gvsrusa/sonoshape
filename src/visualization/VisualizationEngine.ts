import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Mesh3D, Camera, InteractionEvent, ProcessedFrame, AudioFeatures } from '../types/index.js';
import { VisualizationConfig, RenderSettings } from './types.js';

export class VisualizationEngine {
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private container: HTMLElement;
  private meshObject: THREE.Mesh | null = null;
  private lights: THREE.Light[] = [];
  private config: VisualizationConfig;
  private renderSettings: RenderSettings;
  private animationId: number | null = null;

  // Real-time visualization components
  private waveformMesh: THREE.Line | null = null;
  private spectrumBars: THREE.Mesh[] = [];
  private audioFeatures: AudioFeatures | null = null;
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private animationMixer: THREE.AnimationMixer | null = null;
  private highlightMaterial: THREE.Material | null = null;
  private timelineCallbacks: ((time: number) => void)[] = [];

  constructor(container: HTMLElement, config: Partial<VisualizationConfig> = {}) {
    this.container = container;
    this.config = {
      antialias: true,
      shadows: true,
      postProcessing: false,
      ...config
    };
    this.renderSettings = {
      wireframe: false,
      showNormals: false,
      backgroundColor: '#1a1a1a'
    };

    this.initializeRenderer();
    this.initializeScene();
    this.initializeCamera();
    this.initializeLighting();
    this.initializeControls();
    this.startRenderLoop();
  }

  private initializeRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.config.antialias,
      alpha: true
    });
    
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(this.renderSettings.backgroundColor);
    
    if (this.config.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    this.container.appendChild(this.renderer.domElement);
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.renderSettings.backgroundColor);
    
    // Add subtle fog for depth perception
    this.scene.fog = new THREE.Fog(this.renderSettings.backgroundColor, 10, 100);
  }

  private initializeCamera(): void {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);
  }

  private initializeLighting(): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);
    this.lights.push(ambientLight);

    // Main directional light (key light)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = this.config.shadows;
    if (this.config.shadows) {
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.camera.left = -10;
      directionalLight.shadow.camera.right = 10;
      directionalLight.shadow.camera.top = 10;
      directionalLight.shadow.camera.bottom = -10;
    }
    this.scene.add(directionalLight);
    this.lights.push(directionalLight);

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0x4080ff, 0.3);
    fillLight.position.set(-5, 3, -5);
    this.scene.add(fillLight);
    this.lights.push(fillLight);

    // Rim light for edge definition
    const rimLight = new THREE.DirectionalLight(0xff8040, 0.2);
    rimLight.position.set(0, -5, 10);
    this.scene.add(rimLight);
    this.lights.push(rimLight);
  }

  private initializeControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI;
  }

  private startRenderLoop(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      
      // Update animation mixer if playing
      if (this.animationMixer && this.isPlaying) {
        this.animationMixer.update(0.016); // ~60fps
      }
      
      // Update real-time visualizations
      this.updateRealTimeVisualizations();
      
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  public renderMesh(mesh: Mesh3D, camera?: Camera): void {
    // Remove existing mesh if present
    if (this.meshObject) {
      this.scene.remove(this.meshObject);
      this.meshObject.geometry.dispose();
      if (Array.isArray(this.meshObject.material)) {
        this.meshObject.material.forEach(mat => mat.dispose());
      } else {
        this.meshObject.material.dispose();
      }
    }

    // Create Three.js geometry from Mesh3D data
    const geometry = new THREE.BufferGeometry();
    
    // Set vertices
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
    
    // Set faces (indices)
    geometry.setIndex(new THREE.BufferAttribute(mesh.faces, 1));
    
    // Set normals
    if (mesh.normals && mesh.normals.length > 0) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    
    // Set UV coordinates if available
    if (mesh.uvs && mesh.uvs.length > 0) {
      geometry.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
    }

    // Create material with custom shader
    const material = this.createMeshMaterial();
    
    // Create mesh object
    this.meshObject = new THREE.Mesh(geometry, material);
    this.meshObject.castShadow = this.config.shadows;
    this.meshObject.receiveShadow = this.config.shadows;
    
    this.scene.add(this.meshObject);

    // Update camera if provided
    if (camera) {
      this.updateCamera(camera);
    } else {
      // Auto-fit camera to mesh bounds
      this.fitCameraToMesh(mesh);
    }
  }

  private createMeshMaterial(): THREE.Material {
    if (this.renderSettings.wireframe) {
      return new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.8
      });
    }

    // Custom shader material for enhanced visualization
    const material = new THREE.MeshPhongMaterial({
      color: 0x8844ff,
      shininess: 100,
      specular: 0x222222,
      transparent: true,
      opacity: 0.9
    });

    // Add vertex colors based on height for visual interest
    material.vertexColors = false;
    
    return material;
  }

  private fitCameraToMesh(mesh: Mesh3D): void {
    const box = mesh.boundingBox;
    const center = new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      (box.min.y + box.max.y) / 2,
      (box.min.z + box.max.z) / 2
    );

    const size = new THREE.Vector3(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    );

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;

    this.camera.position.set(
      center.x + distance,
      center.y + distance,
      center.z + distance
    );
    
    this.controls.target.copy(center);
    this.controls.update();
  }

  public updateCamera(camera: Camera): void {
    this.camera.position.set(camera.position.x, camera.position.y, camera.position.z);
    this.camera.lookAt(camera.target.x, camera.target.y, camera.target.z);
    this.camera.fov = camera.fov;
    this.camera.aspect = camera.aspect;
    this.camera.near = camera.near;
    this.camera.far = camera.far;
    this.camera.updateProjectionMatrix();
  }

  public handleUserInteraction(event: InteractionEvent): void {
    switch (event.type) {
      case 'rotate':
        // OrbitControls handles rotation automatically
        break;
      case 'zoom':
        const zoomFactor = 1 + (event.deltaY * 0.001);
        this.camera.position.multiplyScalar(zoomFactor);
        break;
      case 'pan':
        // OrbitControls handles panning automatically
        break;
    }
  }

  public updateRenderSettings(settings: Partial<RenderSettings>): void {
    this.renderSettings = { ...this.renderSettings, ...settings };
    
    if (settings.backgroundColor) {
      this.renderer.setClearColor(settings.backgroundColor);
      this.scene.background = new THREE.Color(settings.backgroundColor);
      if (this.scene.fog) {
        (this.scene.fog as THREE.Fog).color = new THREE.Color(settings.backgroundColor);
      }
    }
    
    if (this.meshObject && (settings.wireframe !== undefined)) {
      const material = this.meshObject.material as THREE.Material;
      (material as any).wireframe = settings.wireframe;
      material.needsUpdate = true;
    }
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  // Real-time visualization methods
  public updateRealTime(audioFrame: ProcessedFrame): void {
    this.updateWaveformVisualization(audioFrame);
    this.updateSpectrumAnalyzer(audioFrame);
    this.updateMeshHighlighting(audioFrame);
    this.currentTime = audioFrame.timestamp;
    
    // Notify timeline callbacks
    this.timelineCallbacks.forEach(callback => callback(this.currentTime));
  }

  public animateWithAudio(_audioBuffer: AudioBuffer, mesh: Mesh3D): void {
    if (!this.audioFeatures) return;
    
    this.setupMeshAnimation(mesh);
    this.isPlaying = true;
  }

  public setAudioFeatures(features: AudioFeatures): void {
    this.audioFeatures = features;
    this.setupWaveformVisualization();
    this.setupSpectrumAnalyzer();
  }

  public playAudio(): void {
    this.isPlaying = true;
  }

  public pauseAudio(): void {
    this.isPlaying = false;
  }

  public seekTo(time: number): void {
    this.currentTime = time;
    if (this.animationMixer) {
      this.animationMixer.setTime(time);
    }
  }

  public addTimelineCallback(callback: (time: number) => void): void {
    this.timelineCallbacks.push(callback);
  }

  public removeTimelineCallback(callback: (time: number) => void): void {
    const index = this.timelineCallbacks.indexOf(callback);
    if (index > -1) {
      this.timelineCallbacks.splice(index, 1);
    }
  }

  private updateRealTimeVisualizations(): void {
    if (this.isPlaying && this.audioFeatures) {
      // Update current time based on playback
      this.currentTime += 0.016; // ~60fps increment
      
      // Create mock processed frame for current time
      const frameIndex = Math.floor(this.currentTime * 60); // Assuming 60fps audio analysis
      if (frameIndex < this.audioFeatures.frequencyData.length) {
        const mockFrame: ProcessedFrame = {
          frequencyData: {
            frequencies: this.audioFeatures.frequencyData[frameIndex] || new Float32Array(),
            magnitudes: this.audioFeatures.frequencyData[frameIndex] || new Float32Array(),
            phases: new Float32Array(),
            timestamp: this.currentTime
          },
          amplitudeData: {
            envelope: this.audioFeatures.amplitudeEnvelope,
            peaks: [],
            rms: new Float32Array()
          },
          timestamp: this.currentTime
        };
        
        this.updateRealTime(mockFrame);
      }
    }
  }

  private setupWaveformVisualization(): void {
    if (!this.audioFeatures) return;
    
    // Remove existing waveform
    if (this.waveformMesh) {
      this.scene.remove(this.waveformMesh);
      this.waveformMesh.geometry.dispose();
      (this.waveformMesh.material as THREE.Material).dispose();
    }
    
    // Create waveform geometry
    const points: THREE.Vector3[] = [];
    const envelope = this.audioFeatures.amplitudeEnvelope;
    const width = 10;
    const height = 2;
    
    for (let i = 0; i < envelope.length; i++) {
      const x = (i / envelope.length) * width - width / 2;
      const y = envelope[i] * height;
      const z = -5; // Position behind the main mesh
      points.push(new THREE.Vector3(x, y, z));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.7
    });
    
    this.waveformMesh = new THREE.Line(geometry, material);
    this.scene.add(this.waveformMesh);
  }

  private setupSpectrumAnalyzer(): void {
    if (!this.audioFeatures) return;
    
    // Remove existing spectrum bars
    this.spectrumBars.forEach(bar => {
      this.scene.remove(bar);
      bar.geometry.dispose();
      (bar.material as THREE.Material).dispose();
    });
    this.spectrumBars = [];
    
    // Create spectrum analyzer bars
    const numBars = 64;
    const barWidth = 0.1;
    const barSpacing = 0.15;
    const totalWidth = numBars * barSpacing;
    
    for (let i = 0; i < numBars; i++) {
      const geometry = new THREE.BoxGeometry(barWidth, 0.1, barWidth);
      const hue = i / numBars;
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.5),
        transparent: true,
        opacity: 0.8
      });
      
      const bar = new THREE.Mesh(geometry, material);
      bar.position.x = (i * barSpacing) - (totalWidth / 2);
      bar.position.y = -3; // Position below the main mesh
      bar.position.z = 0;
      
      this.scene.add(bar);
      this.spectrumBars.push(bar);
    }
  }

  private updateWaveformVisualization(_audioFrame: ProcessedFrame): void {
    if (!this.waveformMesh || !this.audioFeatures) return;
    
    // Update waveform position indicator
    const progress = this.currentTime / (this.audioFeatures.amplitudeEnvelope.length / 44100); // Assuming 44.1kHz
    const indicatorX = (progress * 10) - 5; // Map to waveform width
    
    // Create or update time indicator
    if (!this.scene.getObjectByName('waveform-indicator')) {
      const indicatorGeometry = new THREE.PlaneGeometry(0.05, 4);
      const indicatorMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8
      });
      const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
      indicator.name = 'waveform-indicator';
      indicator.position.set(indicatorX, 0, -4.9);
      this.scene.add(indicator);
    } else {
      const indicator = this.scene.getObjectByName('waveform-indicator');
      if (indicator) {
        indicator.position.x = indicatorX;
      }
    }
  }

  private updateSpectrumAnalyzer(audioFrame: ProcessedFrame): void {
    if (this.spectrumBars.length === 0) return;
    
    const frequencies = audioFrame.frequencyData.magnitudes;
    const numBars = this.spectrumBars.length;
    
    for (let i = 0; i < numBars && i < frequencies.length; i++) {
      const bar = this.spectrumBars[i];
      const magnitude = frequencies[i] || 0;
      const height = Math.max(0.1, magnitude * 3); // Scale and ensure minimum height
      
      // Update bar height
      bar.scale.y = height;
      bar.position.y = (height / 2) - 3; // Adjust position to keep bottom at y=-3
      
      // Update color based on magnitude
      const material = bar.material as THREE.MeshPhongMaterial;
      const intensity = Math.min(1, magnitude * 2);
      material.opacity = 0.3 + (intensity * 0.7);
    }
  }

  private updateMeshHighlighting(audioFrame: ProcessedFrame): void {
    if (!this.meshObject || !this.audioFeatures) return;
    
    // Create highlight material if not exists
    if (!this.highlightMaterial) {
      this.highlightMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
      });
    }
    
    // Update mesh material based on audio intensity
    const material = this.meshObject.material as THREE.MeshPhongMaterial;
    const avgMagnitude = audioFrame.frequencyData.magnitudes.reduce((sum, val) => sum + val, 0) / audioFrame.frequencyData.magnitudes.length;
    
    // Pulse effect based on audio intensity
    const pulseIntensity = Math.min(1, avgMagnitude * 2);
    material.emissive.setRGB(pulseIntensity * 0.2, pulseIntensity * 0.1, pulseIntensity * 0.3);
  }

  private setupMeshAnimation(_mesh: Mesh3D): void {
    if (!this.meshObject || !this.audioFeatures) return;
    
    // Create animation mixer
    this.animationMixer = new THREE.AnimationMixer(this.meshObject);
    
    // Create keyframe tracks for mesh animation based on audio features
    const times: number[] = [];
    const values: number[] = [];
    
    // Sample animation keyframes based on audio tempo and beats
    const duration = this.audioFeatures.amplitudeEnvelope.length / 44100; // Assuming 44.1kHz
    const numKeyframes = Math.min(100, Math.floor(duration * 10)); // 10 keyframes per second max
    
    for (let i = 0; i < numKeyframes; i++) {
      const time = (i / numKeyframes) * duration;
      const sampleIndex = Math.floor((i / numKeyframes) * this.audioFeatures.amplitudeEnvelope.length);
      const amplitude = this.audioFeatures.amplitudeEnvelope[sampleIndex] || 0;
      
      times.push(time);
      // Scale animation based on amplitude
      const scale = 1 + (amplitude * 0.2);
      values.push(scale, scale, scale);
    }
    
    // Create scale animation track
    const scaleTrack = new THREE.VectorKeyframeTrack('.scale', times, values);
    
    // Create animation clip
    const clip = new THREE.AnimationClip('audioSync', duration, [scaleTrack]);
    
    // Create and play animation action
    const action = this.animationMixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.play();
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.controls.dispose();
    
    // Dispose mesh object
    if (this.meshObject) {
      this.scene.remove(this.meshObject);
      this.meshObject.geometry.dispose();
      if (Array.isArray(this.meshObject.material)) {
        this.meshObject.material.forEach(mat => mat.dispose());
      } else {
        this.meshObject.material.dispose();
      }
    }
    
    // Dispose waveform visualization
    if (this.waveformMesh) {
      this.scene.remove(this.waveformMesh);
      this.waveformMesh.geometry.dispose();
      (this.waveformMesh.material as THREE.Material).dispose();
    }
    
    // Dispose spectrum analyzer bars
    this.spectrumBars.forEach(bar => {
      this.scene.remove(bar);
      bar.geometry.dispose();
      (bar.material as THREE.Material).dispose();
    });
    
    // Dispose highlight material
    if (this.highlightMaterial) {
      this.highlightMaterial.dispose();
    }
    
    // Dispose animation mixer
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
    }
    
    this.lights.forEach(light => {
      this.scene.remove(light);
    });
    
    this.renderer.dispose();
    
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}