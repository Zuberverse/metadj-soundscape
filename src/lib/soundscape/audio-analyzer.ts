/**
 * Audio Analyzer Service
 * Real-time audio feature extraction using Meyda + BPM detection
 */

import type {
  AudioFeatures,
  AnalysisState,
  NormalizationConfig,
} from "./types";

// ============================================================================
// Global Audio Element Registry
// Track which audio elements have already been connected to avoid
// "HTMLMediaElement already connected" errors
// ============================================================================

interface AudioElementConnection {
  audioContext: AudioContext;
  sourceNode: MediaElementAudioSourceNode;
}

const connectedElements = new WeakMap<HTMLMediaElement, AudioElementConnection>();

// ============================================================================
// Audio Analyzer Class
// ============================================================================

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyzerNode: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private meyda: MeydaAnalyzer | null = null;

  // State
  private isAnalyzing = false;
  private normalization: NormalizationConfig;

  // Feature history for smoothing
  private energyHistory: number[] = [];
  private readonly historyLength = 10;
  private lastEnergy = 0;

  // Beat detection state
  private beatDetector: BeatDetector | null = null;
  private lastBeatTime = 0;
  private detectedBpm: number | null = null;
  private bpmConfidence = 0;

  // Callbacks
  private onAnalysis: ((state: AnalysisState) => void) | null = null;

  constructor(
    normalization: NormalizationConfig = {
      energyMax: 0.15, // Lowered - typical RMS peaks at 0.1-0.2
      spectralCentroidMin: 0, // Zero baseline - any centroid above 0 contributes to brightness
      spectralCentroidMax: 3000, // Reduced for more sensitivity - most content is 200-2000 Hz
      spectralFlatnessMax: 0.5,
    }
  ) {
    this.normalization = normalization;
  }

  /**
   * Initialize analyzer and connect to audio element
   */
  async initialize(audioElement: HTMLAudioElement): Promise<void> {
    // Check if this element was already connected to Web Audio API
    const existing = connectedElements.get(audioElement);

    if (existing) {
      // Reuse existing connection
      this.audioContext = existing.audioContext;
      this.sourceNode = existing.sourceNode;

      // Resume context if it was suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
    } else {
      // Create new connection
      this.audioContext = new AudioContext();
      this.sourceNode = this.audioContext.createMediaElementSource(audioElement);

      // Store in registry for reuse
      connectedElements.set(audioElement, {
        audioContext: this.audioContext,
        sourceNode: this.sourceNode,
      });
    }

    // Create analyzer node (fresh each time)
    this.analyzerNode = this.audioContext.createAnalyser();
    this.analyzerNode.fftSize = 2048;

    // Connect: source -> analyzer -> destination
    this.sourceNode.connect(this.analyzerNode);
    this.analyzerNode.connect(this.audioContext.destination);

    // Initialize Meyda
    await this.initializeMeyda();

    // Initialize beat detector
    this.initializeBeatDetector();
  }

  /**
   * Start real-time analysis
   */
  start(callback: (state: AnalysisState) => void): void {
    this.onAnalysis = callback;
    this.isAnalyzing = true;

    if (this.meyda) {
      this.meyda.start();
    }
  }

  /**
   * Stop analysis
   */
  stop(): void {
    this.isAnalyzing = false;
    this.onAnalysis = null;

    if (this.meyda) {
      this.meyda.stop();
    }
  }

  /**
   * Clean up analyzer resources
   * Note: Audio context and source node are preserved for reuse (Web Audio API limitation)
   */
  destroy(): void {
    this.stop();

    if (this.meyda) {
      this.meyda.stop();
      this.meyda = null;
    }

    // Disconnect analyzer node but keep the source -> destination connection
    // The source node stays connected in the registry for reuse
    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
      this.analyzerNode = null;
    }

    // Don't close the audio context or source node - they're in the registry
    // and will be reused if the same audio element is connected again
    this.audioContext = null;
    this.sourceNode = null;

    this.beatDetector = null;
  }

  /**
   * Update normalization config (for adaptive calibration)
   */
  setNormalization(config: Partial<NormalizationConfig>): void {
    this.normalization = { ...this.normalization, ...config };
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  // ============================================================================
  // Private: Meyda Integration
  // ============================================================================

  private async initializeMeyda(): Promise<void> {
    if (!this.audioContext || !this.sourceNode) {
      throw new Error("Audio context not initialized");
    }

    // SSR guard: Meyda requires browser environment
    if (typeof window === "undefined") {
      console.warn("[AudioAnalyzer] Meyda skipped - running in non-browser environment");
      return;
    }

    try {
      // Dynamic import of Meyda (avoid SSR issues)
      const Meyda = (await import("meyda")).default;

      this.meyda = Meyda.createMeydaAnalyzer({
        audioContext: this.audioContext,
        source: this.sourceNode,
        bufferSize: 512, // ~86 analyses per second at 44.1kHz
        featureExtractors: [
          "rms",
          "spectralCentroid",
          "spectralFlatness",
          "spectralRolloff",
          "zcr",
        ],
        callback: (features: MeydaFeatures) => {
          this.processFeatures(features);
        },
      });
    } catch (error) {
      // Graceful degradation: audio analysis disabled but app continues
      console.error("[AudioAnalyzer] Failed to initialize Meyda:", error);
      console.warn("[AudioAnalyzer] Audio analysis will be disabled for this session");
      this.meyda = null;
    }
  }

  // Debug: frame counter for periodic logging
  private debugFrameCount = 0;

  private processFeatures(features: MeydaFeatures): void {
    if (!this.isAnalyzing || !this.onAnalysis) return;

    // Extract raw features
    const rawFeatures: AudioFeatures = {
      rms: features.rms ?? 0,
      spectralCentroid: features.spectralCentroid ?? 0,
      spectralFlatness: features.spectralFlatness ?? 0,
      spectralRolloff: features.spectralRolloff ?? 0,
      zcr: features.zcr ?? 0,
    };

    // Debug: Log audio levels every ~2 seconds (at 86Hz = ~172 frames)
    this.debugFrameCount++;
    if (process.env.NODE_ENV === "development" && this.debugFrameCount % 172 === 0) {
      const rmsDb = rawFeatures.rms > 0 ? 20 * Math.log10(rawFeatures.rms) : -100;
      console.log(`[AudioAnalyzer] 🎵 RMS: ${rawFeatures.rms.toFixed(4)} (${rmsDb.toFixed(1)} dB), Centroid: ${rawFeatures.spectralCentroid.toFixed(0)} Hz`);
      if (rawFeatures.rms < 0.001) {
        console.warn("[AudioAnalyzer] ⚠️ Audio appears silent - is music playing?");
      }
    }

    // Compute derived metrics
    const derived = this.computeDerived(rawFeatures);

    // Update beat detector with energy
    this.updateBeatDetection(derived.energy);

    // Build analysis state
    const state: AnalysisState = {
      features: rawFeatures,
      beat: {
        bpm: this.detectedBpm,
        confidence: this.bpmConfidence,
        lastBeatTime: this.lastBeatTime,
        isBeat: this.checkBeat(),
      },
      derived,
    };

    // Emit to callback
    this.onAnalysis(state);
  }

  // ============================================================================
  // Private: Derived Metrics
  // ============================================================================

  private computeDerived(features: AudioFeatures): AnalysisState["derived"] {
    const { energyMax, spectralCentroidMin, spectralCentroidMax, spectralFlatnessMax } =
      this.normalization;

    // Normalize energy (RMS)
    const energy = Math.min(1, features.rms / energyMax);

    // Track energy history for derivative and peak
    this.energyHistory.push(energy);
    if (this.energyHistory.length > this.historyLength) {
      this.energyHistory.shift();
    }

    // Energy derivative (rate of change)
    const energyDerivative = energy - this.lastEnergy;
    this.lastEnergy = energy;

    // Peak energy from recent history
    const peakEnergy = Math.max(...this.energyHistory, 0.1);

    // Normalize brightness (spectral centroid)
    const centroidNorm =
      (features.spectralCentroid - spectralCentroidMin) /
      (spectralCentroidMax - spectralCentroidMin);
    const brightness = Math.max(0, Math.min(1, centroidNorm));

    // Normalize texture (spectral flatness)
    const texture = Math.min(1, features.spectralFlatness / spectralFlatnessMax);

    return {
      energy,
      brightness,
      texture,
      energyDerivative,
      peakEnergy,
    };
  }

  // ============================================================================
  // Private: Beat Detection
  // ============================================================================

  private initializeBeatDetector(): void {
    // Simple energy-based beat detector
    // For MVP, we use energy peaks rather than full BPM analysis
    this.beatDetector = new BeatDetector();
  }

  private updateBeatDetection(energy: number): void {
    if (!this.beatDetector) return;

    const beatResult = this.beatDetector.update(energy);

    if (beatResult.isBeat) {
      this.lastBeatTime = Date.now();
    }

    if (beatResult.bpm !== null) {
      this.detectedBpm = beatResult.bpm;
      this.bpmConfidence = beatResult.confidence;
    }
  }

  private checkBeat(): boolean {
    // Note: Could add energy param for threshold-based detection enhancement
    return this.beatDetector?.isBeatFrame() ?? false;
  }
}

// ============================================================================
// Beat Detector (Energy-Based)
// ============================================================================

/**
 * Energy-based beat detector for real-time audio analysis.
 *
 * Detects beats by identifying energy spikes that exceed a threshold above
 * the recent average energy. Uses a simple but effective algorithm suitable
 * for real-time visual synchronization.
 *
 * **Algorithm Overview:**
 * 1. Maintains a rolling history of energy values (~500ms window)
 * 2. Compares current energy against the average * threshold
 * 3. Requires minimum frame gap between beats to avoid false positives
 * 4. Calculates BPM from inter-beat intervals when sufficient beats detected
 *
 * **Limitations:**
 * - Works best with music that has clear transients (drums, bass drops)
 * - May miss beats in ambient/continuous music
 * - BPM accuracy depends on consistent beat patterns
 *
 * @example
 * ```ts
 * const detector = new BeatDetector();
 *
 * // In analysis loop (~86Hz)
 * const result = detector.update(normalizedEnergy);
 * if (result.isBeat) {
 *   triggerVisualPulse();
 * }
 * if (result.bpm) {
 *   syncToTempo(result.bpm);
 * }
 * ```
 */
class BeatDetector {
  /** Rolling energy values for computing average */
  private energyHistory: number[] = [];

  /** Number of frames to keep in history (~500ms at 86Hz analysis rate) */
  private readonly historyLength = 43;

  /** Energy spike threshold multiplier (1.3 = 30% above average) */
  private threshold = 1.3;

  /** Frame number of last detected beat */
  private lastBeatFrame = 0;

  /** Total frames processed */
  private frameCount = 0;

  /** Timestamps of detected beats for BPM calculation */
  private beatTimes: number[] = [];

  /**
   * Process a new energy sample and detect beats.
   *
   * Call this method for each audio analysis frame (typically ~86Hz).
   * The method updates internal state and returns beat detection results.
   *
   * @param energy - Normalized energy value (0-1) from audio analysis
   * @returns Detection results including beat flag, estimated BPM, and confidence
   *
   * @example
   * ```ts
   * const { isBeat, bpm, confidence } = detector.update(0.75);
   * // isBeat: true if this frame is a beat
   * // bpm: estimated tempo (60-200) or null if insufficient data
   * // confidence: 0-1 indicating BPM reliability
   * ```
   */
  update(energy: number): { isBeat: boolean; bpm: number | null; confidence: number } {
    this.frameCount++;
    this.energyHistory.push(energy);

    if (this.energyHistory.length > this.historyLength) {
      this.energyHistory.shift();
    }

    // Calculate average energy
    const avgEnergy =
      this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;

    // Check for beat (energy spike above threshold)
    const isBeat =
      energy > avgEnergy * this.threshold &&
      this.frameCount - this.lastBeatFrame > 8; // Minimum 8 frames between beats

    if (isBeat) {
      this.lastBeatFrame = this.frameCount;
      this.beatTimes.push(Date.now());

      // Keep only recent beat times (last 30 seconds)
      const cutoff = Date.now() - 30000;
      this.beatTimes = this.beatTimes.filter((t) => t > cutoff);
    }

    // Calculate BPM from beat intervals
    let bpm: number | null = null;
    let confidence = 0;

    if (this.beatTimes.length >= 4) {
      const intervals: number[] = [];
      for (let i = 1; i < this.beatTimes.length; i++) {
        intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
      }

      // Average interval
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      bpm = Math.round(60000 / avgInterval);

      // Clamp to reasonable BPM range
      if (bpm < 60 || bpm > 200) {
        bpm = null;
      } else {
        // Calculate confidence based on interval variance
        const variance =
          intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) /
          intervals.length;
        const stdDev = Math.sqrt(variance);
        confidence = Math.max(0, 1 - stdDev / avgInterval);
      }
    }

    return { isBeat, bpm, confidence };
  }

  /**
   * Check if the current frame was detected as a beat.
   *
   * Use this method to query beat status without processing new data.
   * Useful when the beat detection is run separately from the visual update loop.
   *
   * @returns True if the most recently processed frame was a beat
   */
  isBeatFrame(): boolean {
    return this.frameCount === this.lastBeatFrame;
  }
}

// ============================================================================
// Type Definitions for Meyda
// ============================================================================

interface MeydaFeatures {
  rms?: number;
  spectralCentroid?: number;
  spectralFlatness?: number;
  spectralRolloff?: number;
  zcr?: number;
}

interface MeydaAnalyzer {
  start(): void;
  stop(): void;
}
