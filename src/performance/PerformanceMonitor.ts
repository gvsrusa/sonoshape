/**
 * Performance monitoring and automatic quality adjustment system
 * Monitors system performance and adjusts quality settings automatically
 */

export interface DeviceCapabilities {
  cpuCores: number;
  memoryGB: number;
  gpuTier: 'low' | 'medium' | 'high';
  webglSupport: boolean;
  webgl2Support: boolean;
  maxTextureSize: number;
  maxVertexAttributes: number;
  isLowEndDevice: boolean;
}

export interface PerformanceMetrics {
  frameRate: number;
  frameTime: number;
  memoryUsage: number;
  cpuUsage: number;
  renderTime: number;
  audioProcessingTime: number;
  meshGenerationTime: number;
}

export interface QualitySettings {
  meshResolution: number;
  fftSize: number;
  visualizationQuality: 'low' | 'medium' | 'high';
  enableShadows: boolean;
  enablePostProcessing: boolean;
  maxPolygons: number;
  audioBufferSize: number;
  useWebWorkers: boolean;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    frameRate: 60,
    frameTime: 16.67,
    memoryUsage: 0,
    cpuUsage: 0,
    renderTime: 0,
    audioProcessingTime: 0,
    meshGenerationTime: 0
  };

  private frameRateHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryMonitorInterval: number | null = null;
  
  private qualitySettings: QualitySettings;
  private deviceCapabilities: DeviceCapabilities;
  private autoAdjustEnabled: boolean = true;
  private performanceCallbacks: ((metrics: PerformanceMetrics) => void)[] = [];

  constructor() {
    this.deviceCapabilities = this.detectDeviceCapabilities();
    this.qualitySettings = this.getInitialQualitySettings();
    this.initializeMonitoring();
  }

  /**
   * Detect device capabilities for automatic quality adjustment
   */
  private detectDeviceCapabilities(): DeviceCapabilities {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const gl2 = canvas.getContext('webgl2');
    
    let gpuTier: 'low' | 'medium' | 'high' = 'medium';
    let maxTextureSize = 1024;
    let maxVertexAttributes = 8;

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        gpuTier = this.classifyGPU(renderer);
      }
      
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      maxVertexAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    }

    // Estimate CPU cores (navigator.hardwareConcurrency)
    const cpuCores = navigator.hardwareConcurrency || 4;
    
    // Estimate memory (rough approximation)
    const memoryGB = this.estimateDeviceMemory();
    
    // Determine if this is a low-end device
    const isLowEndDevice = this.isLowEndDevice(cpuCores, memoryGB, gpuTier);

    canvas.remove();

    return {
      cpuCores,
      memoryGB,
      gpuTier,
      webglSupport: !!gl,
      webgl2Support: !!gl2,
      maxTextureSize,
      maxVertexAttributes,
      isLowEndDevice
    };
  }

  private classifyGPU(renderer: string): 'low' | 'medium' | 'high' {
    const rendererLower = renderer.toLowerCase();
    
    // High-end GPUs
    if (rendererLower.includes('rtx') || 
        rendererLower.includes('gtx 1080') ||
        rendererLower.includes('gtx 1070') ||
        rendererLower.includes('radeon rx') ||
        rendererLower.includes('vega')) {
      return 'high';
    }
    
    // Low-end GPUs
    if (rendererLower.includes('intel') ||
        rendererLower.includes('integrated') ||
        rendererLower.includes('gt ') ||
        rendererLower.includes('uhd') ||
        rendererLower.includes('iris')) {
      return 'low';
    }
    
    return 'medium';
  }

  private estimateDeviceMemory(): number {
    // Use navigator.deviceMemory if available (Chrome)
    if ('deviceMemory' in navigator) {
      return (navigator as any).deviceMemory;
    }
    
    // Fallback estimation based on other factors
    const cores = navigator.hardwareConcurrency || 4;
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('mobile') || userAgent.includes('android')) {
      return cores <= 4 ? 2 : 4; // Mobile devices typically have 2-4GB
    }
    
    return cores <= 4 ? 4 : 8; // Desktop devices typically have 4-8GB+
  }

  private isLowEndDevice(cpuCores: number, memoryGB: number, gpuTier: string): boolean {
    return cpuCores <= 2 || memoryGB <= 2 || gpuTier === 'low';
  }

  /**
   * Get initial quality settings based on device capabilities
   */
  private getInitialQualitySettings(): QualitySettings {
    const caps = this.deviceCapabilities;
    
    if (caps.isLowEndDevice) {
      return {
        meshResolution: 32,
        fftSize: 1024,
        visualizationQuality: 'low',
        enableShadows: false,
        enablePostProcessing: false,
        maxPolygons: 5000,
        audioBufferSize: 2048,
        useWebWorkers: caps.cpuCores > 1
      };
    } else if (caps.gpuTier === 'high' && caps.cpuCores >= 6) {
      return {
        meshResolution: 128,
        fftSize: 4096,
        visualizationQuality: 'high',
        enableShadows: true,
        enablePostProcessing: true,
        maxPolygons: 50000,
        audioBufferSize: 4096,
        useWebWorkers: true
      };
    } else {
      return {
        meshResolution: 64,
        fftSize: 2048,
        visualizationQuality: 'medium',
        enableShadows: true,
        enablePostProcessing: false,
        maxPolygons: 20000,
        audioBufferSize: 2048,
        useWebWorkers: caps.cpuCores > 2
      };
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    // Monitor frame rate
    this.startFrameRateMonitoring();
    
    // Monitor memory usage
    this.startMemoryMonitoring();
    
    // Monitor performance entries
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });
      
      try {
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      } catch (e) {
        console.warn('PerformanceObserver not fully supported:', e);
      }
    }
  }

  private startFrameRateMonitoring(): void {
    const measureFrameRate = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const frameTime = timestamp - this.lastFrameTime;
        const frameRate = 1000 / frameTime;
        
        this.frameTimeHistory.push(frameTime);
        this.frameRateHistory.push(frameRate);
        
        // Keep only last 60 frames for rolling average
        if (this.frameTimeHistory.length > 60) {
          this.frameTimeHistory.shift();
          this.frameRateHistory.shift();
        }
        
        // Update metrics
        this.metrics.frameTime = this.getAverage(this.frameTimeHistory);
        this.metrics.frameRate = this.getAverage(this.frameRateHistory);
        
        // Check for performance issues and auto-adjust
        if (this.autoAdjustEnabled && this.frameCount % 60 === 0) {
          this.checkAndAdjustQuality();
        }
      }
      
      this.lastFrameTime = timestamp;
      this.frameCount++;
      
      requestAnimationFrame(measureFrameRate);
    };
    
    requestAnimationFrame(measureFrameRate);
  }

  private startMemoryMonitoring(): void {
    if ('memory' in performance) {
      this.memoryMonitorInterval = window.setInterval(() => {
        const memory = (performance as any).memory;
        this.metrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // MB
      }, 1000);
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    if (entry.name.includes('audio-processing')) {
      this.metrics.audioProcessingTime = entry.duration;
    } else if (entry.name.includes('mesh-generation')) {
      this.metrics.meshGenerationTime = entry.duration;
    } else if (entry.name.includes('render')) {
      this.metrics.renderTime = entry.duration;
    }
  }

  /**
   * Check performance and automatically adjust quality settings
   */
  private checkAndAdjustQuality(): void {
    const targetFrameRate = 30; // Minimum acceptable frame rate
    const targetFrameTime = 33.33; // Maximum acceptable frame time (30fps)
    
    if (this.metrics.frameRate < targetFrameRate || this.metrics.frameTime > targetFrameTime) {
      this.reduceQuality();
    } else if (this.metrics.frameRate > 50 && this.metrics.frameTime < 20) {
      // Performance is good, maybe we can increase quality
      this.increaseQuality();
    }
    
    // Notify callbacks about performance changes
    this.performanceCallbacks.forEach(callback => callback(this.metrics));
  }

  private reduceQuality(): void {
    let adjusted = false;
    
    // Reduce mesh resolution
    if (this.qualitySettings.meshResolution > 16) {
      this.qualitySettings.meshResolution = Math.max(16, this.qualitySettings.meshResolution * 0.75);
      adjusted = true;
    }
    
    // Reduce FFT size
    if (this.qualitySettings.fftSize > 512) {
      this.qualitySettings.fftSize = Math.max(512, this.qualitySettings.fftSize / 2);
      adjusted = true;
    }
    
    // Disable shadows
    if (this.qualitySettings.enableShadows) {
      this.qualitySettings.enableShadows = false;
      adjusted = true;
    }
    
    // Disable post-processing
    if (this.qualitySettings.enablePostProcessing) {
      this.qualitySettings.enablePostProcessing = false;
      adjusted = true;
    }
    
    // Reduce max polygons
    if (this.qualitySettings.maxPolygons > 1000) {
      this.qualitySettings.maxPolygons = Math.max(1000, this.qualitySettings.maxPolygons * 0.75);
      adjusted = true;
    }
    
    // Lower visualization quality
    if (this.qualitySettings.visualizationQuality === 'high') {
      this.qualitySettings.visualizationQuality = 'medium';
      adjusted = true;
    } else if (this.qualitySettings.visualizationQuality === 'medium') {
      this.qualitySettings.visualizationQuality = 'low';
      adjusted = true;
    }
    
    if (adjusted) {
      console.log('Performance: Quality reduced due to low frame rate', this.qualitySettings);
    }
  }

  private increaseQuality(): void {
    let adjusted = false;
    const caps = this.deviceCapabilities;
    
    // Only increase quality if device can handle it
    if (caps.isLowEndDevice) return;
    
    // Increase visualization quality
    if (this.qualitySettings.visualizationQuality === 'low' && caps.gpuTier !== 'low') {
      this.qualitySettings.visualizationQuality = 'medium';
      adjusted = true;
    } else if (this.qualitySettings.visualizationQuality === 'medium' && caps.gpuTier === 'high') {
      this.qualitySettings.visualizationQuality = 'high';
      adjusted = true;
    }
    
    // Enable shadows if GPU can handle it
    if (!this.qualitySettings.enableShadows && caps.gpuTier !== 'low') {
      this.qualitySettings.enableShadows = true;
      adjusted = true;
    }
    
    // Increase mesh resolution
    if (this.qualitySettings.meshResolution < 64 && caps.gpuTier !== 'low') {
      this.qualitySettings.meshResolution = Math.min(128, this.qualitySettings.meshResolution * 1.25);
      adjusted = true;
    }
    
    if (adjusted) {
      console.log('Performance: Quality increased due to good performance', this.qualitySettings);
    }
  }

  private getAverage(array: number[]): number {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  /**
   * Manually measure performance of a specific operation
   */
  public measureOperation<T>(name: string, operation: () => T): T {
    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    
    performance.mark(`${name}-start`);
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    return result;
  }

  /**
   * Async version of measureOperation
   */
  public async measureAsyncOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    
    performance.mark(`${name}-start`);
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    return result;
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current quality settings
   */
  public getQualitySettings(): QualitySettings {
    return { ...this.qualitySettings };
  }

  /**
   * Get device capabilities
   */
  public getDeviceCapabilities(): DeviceCapabilities {
    return { ...this.deviceCapabilities };
  }

  /**
   * Manually set quality settings
   */
  public setQualitySettings(settings: Partial<QualitySettings>): void {
    this.qualitySettings = { ...this.qualitySettings, ...settings };
  }

  /**
   * Enable or disable automatic quality adjustment
   */
  public setAutoAdjust(enabled: boolean): void {
    this.autoAdjustEnabled = enabled;
  }

  /**
   * Add callback for performance updates
   */
  public addPerformanceCallback(callback: (metrics: PerformanceMetrics) => void): void {
    this.performanceCallbacks.push(callback);
  }

  /**
   * Remove performance callback
   */
  public removePerformanceCallback(callback: (metrics: PerformanceMetrics) => void): void {
    const index = this.performanceCallbacks.indexOf(callback);
    if (index > -1) {
      this.performanceCallbacks.splice(index, 1);
    }
  }

  /**
   * Get performance recommendations
   */
  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const caps = this.deviceCapabilities;
    const metrics = this.metrics;
    
    if (metrics.frameRate < 30) {
      recommendations.push('Frame rate is low. Consider reducing mesh resolution or disabling shadows.');
    }
    
    if (metrics.memoryUsage > 100) {
      recommendations.push('High memory usage detected. Consider reducing audio buffer size or mesh complexity.');
    }
    
    if (caps.isLowEndDevice) {
      recommendations.push('Low-end device detected. Using optimized settings for better performance.');
    }
    
    if (!caps.webgl2Support) {
      recommendations.push('WebGL 2.0 not supported. Some advanced features may be disabled.');
    }
    
    if (metrics.audioProcessingTime > 50) {
      recommendations.push('Audio processing is slow. Consider using Web Workers or reducing FFT size.');
    }
    
    if (metrics.meshGenerationTime > 100) {
      recommendations.push('Mesh generation is slow. Consider reducing mesh resolution.');
    }
    
    return recommendations;
  }

  /**
   * Clean up monitoring resources
   */
  public dispose(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
    
    this.performanceCallbacks = [];
  }
}