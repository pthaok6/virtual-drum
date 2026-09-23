import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { DRUMS } from '../data/drums';
import { DrumType } from '../types';

export interface HandPosition {
  x: number; // 0 to 100% of the visible camera area
  y: number; // 0 to 100% of the visible camera area
  isActive: boolean;
}

export interface TrackingState {
  isStreaming: boolean;
  isInitializing: boolean;
  permissionGranted: boolean;
  error: string | null;
  leftHand: HandPosition;
  rightHand: HandPosition;
  zoneEnergies: Record<DrumType, number>; // 0 to 100%
}

export type DrumHitCallback = (drum: DrumType, energy: number, x: number, y: number) => void;

type HandSlot = 'left' | 'right';

const INDEX_FINGER_TIP = 8;
const MIN_INFERENCE_INTERVAL_MS = 16; // Allow tracking at up to roughly 60 FPS.
const LOST_HAND_GRACE_MS = 180;
const EMPTY_ZONE_ENERGIES: Record<DrumType, number> = {
  hihat: 0,
  tom: 0,
  crash: 0,
  snare: 0,
  kick: 0,
};

class CameraTracker {
  private video: HTMLVideoElement | null = null;
  private animFrameId: number | null = null;
  private videoFrameCallbackId: number | null = null;
  private videoFrameCallbackSource: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private handLandmarkerPromise: Promise<HandLandmarker> | null = null;
  private startPromise: Promise<boolean> | null = null;
  private lastVideoTime = -1;
  private lastInferenceTime = 0;

  private onHitListeners: Set<DrumHitCallback> = new Set();
  private onStateChangeListeners: Set<(state: TrackingState) => void> = new Set();

  private lastTriggerTime: Record<DrumType, number> = {
    hihat: 0,
    tom: 0,
    crash: 0,
    snare: 0,
    kick: 0,
  };

  private activeZoneByHand: Record<HandSlot, DrumType | null> = {
    left: null,
    right: null,
  };

  private lastSeenTimeByHand: Record<HandSlot, number> = {
    left: 0,
    right: 0,
  };

  private mirror = true;
  private minTriggerCooldownMs = 140;

  private state: TrackingState = {
    isStreaming: false,
    isInitializing: false,
    permissionGranted: false,
    error: null,
    leftHand: { x: 30, y: 50, isActive: false },
    rightHand: { x: 70, y: 50, isActive: false },
    zoneEnergies: { ...EMPTY_ZONE_ENERGIES },
  };

  public setMirror(mirror: boolean) {
    if (mirror !== this.mirror) {
      this.mirror = mirror;
      this.resetFingerTracking();
    }
  }

  public subscribeHit(cb: DrumHitCallback): () => void {
    this.onHitListeners.add(cb);
    return () => {
      this.onHitListeners.delete(cb);
    };
  }

  public subscribeState(cb: (state: TrackingState) => void): () => void {
    this.onStateChangeListeners.add(cb);
    cb(this.state);
    return () => {
      this.onStateChangeListeners.delete(cb);
    };
  }

  private updateState(partial: Partial<TrackingState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChangeListeners.forEach((cb) => cb(this.state));
  }

  public async start(videoElement?: HTMLVideoElement, deviceId?: string): Promise<boolean> {
    if (this.state.isStreaming && this.stream) {
      if (videoElement && this.video !== videoElement) {
        await this.attachStreamToVideo(videoElement);
      }
      return true;
    }

    if (this.startPromise) {
      const started = await this.startPromise;
      if (started && videoElement && this.video !== videoElement) {
        await this.attachStreamToVideo(videoElement);
      }
      return started;
    }

    this.startPromise = this.startCamera(videoElement, deviceId);
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startCamera(videoElement?: HTMLVideoElement, deviceId?: string): Promise<boolean> {
    try {
      this.updateState({ error: null, isInitializing: true });
      await this.initializeHandLandmarker();

      const constraints: MediaStreamConstraints = {
        video: {
          // Hand landmarks do not need an HD feed. Keeping capture modest lowers
          // upload/inference cost considerably on integrated GPUs and mobile CPUs.
          width: { ideal: 480, max: 640 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 60, max: 60 },
          facingMode: 'user',
          deviceId: deviceId ? { exact: deviceId } : undefined,
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      await this.attachStreamToVideo(videoElement || document.createElement('video'));

      this.resetFingerTracking();
      this.updateState({
        isStreaming: true,
        isInitializing: false,
        permissionGranted: true,
        error: null,
      });

      this.startProcessingLoop();
      return true;
    } catch (err: unknown) {
      this.releaseMediaStream();
      const message = err instanceof Error ? err.message : 'Camera or hand tracking initialization failed';
      console.warn('Camera initialization error:', message);
      this.updateState({
        isStreaming: false,
        isInitializing: false,
        permissionGranted: false,
        error: this.getFriendlyStartupError(err),
      });
      return false;
    }
  }

  private async initializeHandLandmarker(): Promise<HandLandmarker> {
    if (this.handLandmarker) return this.handLandmarker;

    if (!this.handLandmarkerPromise) {
      this.handLandmarkerPromise = this.createHandLandmarker().catch((error) => {
        this.handLandmarkerPromise = null;
        throw error;
      });
    }

    this.handLandmarker = await this.handLandmarkerPromise;
    return this.handLandmarker;
  }

  private async createHandLandmarker(): Promise<HandLandmarker> {
    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const wasmRoot = `${baseUrl}mediapipe/wasm`;
    const modelAssetPath = `${baseUrl}mediapipe/models/hand_landmarker.task`;
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);
    const commonOptions = {
      runningMode: 'VIDEO' as const,
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    try {
      return await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: 'GPU' },
        ...commonOptions,
      });
    } catch (gpuError) {
      console.warn('MediaPipe GPU delegate unavailable; falling back to CPU.', gpuError);
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: 'CPU' },
        ...commonOptions,
      });
    }
  }

  private async attachStreamToVideo(video: HTMLVideoElement) {
    if (!this.stream) return;

    const shouldRestartProcessing = this.state.isStreaming;
    if (shouldRestartProcessing) {
      this.cancelProcessingLoop();
    }

    if (this.video && this.video !== video) {
      this.video.srcObject = null;
    }

    this.video = video;
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.srcObject = this.stream;
    await this.video.play();
    this.lastVideoTime = -1;
    this.lastInferenceTime = 0;

    if (shouldRestartProcessing) {
      this.startProcessingLoop();
    }
  }

  public stop() {
    this.cancelProcessingLoop();

    this.releaseMediaStream();
    this.lastVideoTime = -1;
    this.lastInferenceTime = 0;
    this.resetFingerTracking();
    this.updateState({
      isStreaming: false,
      isInitializing: false,
      leftHand: { ...this.state.leftHand, isActive: false },
      rightHand: { ...this.state.rightHand, isActive: false },
      zoneEnergies: { ...EMPTY_ZONE_ENERGIES },
    });
  }

  private releaseMediaStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }

  private getFriendlyStartupError(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return 'Camera permission was blocked. Allow camera access for this site, then try again.';
      }
      if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        return 'No usable camera was found. Check the selected camera in Settings.';
      }
      if (error.name === 'NotReadableError' || error.name === 'AbortError') {
        return 'The camera is busy or unavailable. Close other apps using it, then try again.';
      }
    }

    const message = error instanceof Error ? error.message : '';
    return message || 'Could not start the camera. Check browser permissions and try again.';
  }

  private resetFingerTracking() {
    this.activeZoneByHand = { left: null, right: null };
    this.lastSeenTimeByHand = { left: 0, right: 0 };
  }

  public triggerManualHit(drum: DrumType, energy: number = 0.8) {
    const d = DRUMS.find((item) => item.id === drum);
    const x = d ? d.visualZone.x + d.visualZone.width / 2 : 50;
    const y = d ? d.visualZone.y + d.visualZone.height / 2 : 50;
    this.onHitListeners.forEach((cb) => cb(drum, energy, x, y));
  }

  private startProcessingLoop() {
    this.cancelProcessingLoop();

    const processFrame = (timestamp: number) => {
      if (!this.state.isStreaming || !this.video || !this.handLandmarker) {
        return;
      }

      if (
        this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        !this.video.paused &&
        this.video.currentTime !== this.lastVideoTime &&
        timestamp - this.lastInferenceTime >= MIN_INFERENCE_INTERVAL_MS
      ) {
        this.lastVideoTime = this.video.currentTime;
        this.lastInferenceTime = timestamp;

        try {
          const result = this.handLandmarker.detectForVideo(this.video, timestamp);
          this.processHandResults(result, timestamp);
        } catch (error) {
          console.warn('MediaPipe frame processing failed:', error);
        }
      }

      this.scheduleNextFrame(processFrame);
    };

    this.scheduleNextFrame(processFrame);
  }

  /**
   * Run inference when the camera actually produces a frame. This avoids the
   * extra 60 Hz polling/render pressure of requestAnimationFrame on the camera
   * stream, while retaining a fallback for older browsers.
   */
  private scheduleNextFrame(callback: (timestamp: number) => void) {
    const video = this.video;
    if (!video) return;

    if (typeof video.requestVideoFrameCallback === 'function') {
      this.videoFrameCallbackSource = video;
      this.videoFrameCallbackId = video.requestVideoFrameCallback((now) => {
        this.videoFrameCallbackId = null;
        this.videoFrameCallbackSource = null;
        callback(now);
      });
      return;
    }

    this.animFrameId = requestAnimationFrame((now) => {
      this.animFrameId = null;
      callback(now);
    });
  }

  private cancelProcessingLoop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.videoFrameCallbackId !== null && this.videoFrameCallbackSource) {
      this.videoFrameCallbackSource.cancelVideoFrameCallback(this.videoFrameCallbackId);
      this.videoFrameCallbackId = null;
      this.videoFrameCallbackSource = null;
    }
  }

  private processHandResults(result: HandLandmarkerResult, timestamp: number) {
    const detectedTips: Partial<Record<HandSlot, { x: number; y: number }>> = {};

    result.landmarks.forEach((landmarks, index) => {
      const indexTip = landmarks[INDEX_FINGER_TIP];
      if (!indexTip) return;

      const position = this.toVisiblePosition(indexTip.x, indexTip.y);
      const handedness = result.handedness[index]?.[0]?.categoryName?.toLowerCase();
      let slot: HandSlot = handedness === 'left' ? 'left' : 'right';

      // Keep both detected hands even when handedness is temporarily ambiguous.
      if (detectedTips[slot]) {
        slot = slot === 'left' ? 'right' : 'left';
      }

      detectedTips[slot] = position;
    });

    const zoneEnergies: Record<DrumType, number> = { ...EMPTY_ZONE_ENERGIES };
    const leftHand = this.updateTrackedHand('left', detectedTips.left, timestamp, zoneEnergies);
    const rightHand = this.updateTrackedHand('right', detectedTips.right, timestamp, zoneEnergies);

    this.updateState({ leftHand, rightHand, zoneEnergies });
  }

  private updateTrackedHand(
    slot: HandSlot,
    tip: { x: number; y: number } | undefined,
    timestamp: number,
    zoneEnergies: Record<DrumType, number>
  ): HandPosition {
    if (!tip) {
      // Brief landmark dropouts should not retrigger a drum while the finger
      // remains in place. Release the current drum only after a short grace.
      if (timestamp - this.lastSeenTimeByHand[slot] > LOST_HAND_GRACE_MS) {
        this.activeZoneByHand[slot] = null;
      }
      const previousPosition = slot === 'left' ? this.state.leftHand : this.state.rightHand;
      return { ...previousPosition, isActive: false };
    }

    this.lastSeenTimeByHand[slot] = timestamp;
    const currentZone = this.getZoneAtPosition(tip.x, tip.y);
    const previousZone = this.activeZoneByHand[slot];

    if (currentZone) {
      zoneEnergies[currentZone] = 100;
    }

    // Entering the visible drum is enough to trigger it; no strike-speed
    // calculation is needed.
    if (currentZone && currentZone !== previousZone) {
      const sinceLastHit = timestamp - this.lastTriggerTime[currentZone];

      if (sinceLastHit > this.minTriggerCooldownMs) {
        this.lastTriggerTime[currentZone] = timestamp;
        this.onHitListeners.forEach((cb) => cb(currentZone, 0.8, tip.x, tip.y));
      }
    }

    this.activeZoneByHand[slot] = currentZone;
    return { ...tip, isActive: true };
  }

  private getZoneAtPosition(x: number, y: number): DrumType | null {
    const drum = DRUMS.find(
      ({ visualZone }) =>
        x >= visualZone.x &&
        x <= visualZone.x + visualZone.width &&
        y >= visualZone.y &&
        y <= visualZone.y + visualZone.height
    );
    return drum?.id ?? null;
  }

  /** Maps MediaPipe image coordinates onto the video's CSS `object-cover` area. */
  private toVisiblePosition(normalizedX: number, normalizedY: number) {
    const videoWidth = this.video?.videoWidth || 1;
    const videoHeight = this.video?.videoHeight || 1;
    const viewWidth = this.video?.clientWidth || videoWidth;
    const viewHeight = this.video?.clientHeight || videoHeight;
    const videoAspect = videoWidth / videoHeight;
    const viewAspect = viewWidth / viewHeight;

    let visibleX = normalizedX;
    let visibleY = normalizedY;

    if (videoAspect > viewAspect) {
      const renderedWidth = viewHeight * videoAspect;
      const cropX = (renderedWidth - viewWidth) / 2;
      visibleX = (normalizedX * renderedWidth - cropX) / viewWidth;
    } else if (videoAspect < viewAspect) {
      const renderedHeight = viewWidth / videoAspect;
      const cropY = (renderedHeight - viewHeight) / 2;
      visibleY = (normalizedY * renderedHeight - cropY) / viewHeight;
    }

    if (this.mirror) {
      visibleX = 1 - visibleX;
    }

    return {
      x: Math.max(0, Math.min(100, visibleX * 100)),
      y: Math.max(0, Math.min(100, visibleY * 100)),
    };
  }

  public async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'videoinput');
    } catch {
      return [];
    }
  }
}

export const cameraTracker = new CameraTracker();
