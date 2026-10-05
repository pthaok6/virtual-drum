import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { DRUMS } from '../data/drums';
import { DrumType } from '../types';
import { drumLayoutService } from './drumLayout';

export interface HandPosition {
  x: number; // 0 to 100% of the visible camera area
  y: number; // 0 to 100% of the visible camera area
  isActive: boolean;
  velocity?: number; // 0.2 to 1.2
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

export type HandSlot = 'left' | 'right';

export type DrumHitCallback = (
  drum: DrumType,
  velocity: number,
  x: number,
  y: number,
  hand?: HandSlot
) => void;

const INDEX_FINGER_TIP = 8;
const MIN_INFERENCE_INTERVAL_MS = 16; // Up to 60 FPS
const LOST_HAND_GRACE_MS = 180;
const EMPTY_ZONE_ENERGIES: Record<DrumType, number> = {
  hihat: 0,
  tom: 0,
  crash: 0,
  snare: 0,
  kick: 0,
};

interface HandTrajectory {
  lastY: number;
  lastTime: number;
  downwardSpeed: number; // % per second
  isMovingDown: boolean;
}

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

  // Independent cooldown per hand and drum to support 2-handed simultaneous hits & fast rolls
  private lastTriggerTimeByHand: Record<HandSlot, Record<DrumType, number>> = {
    left: { hihat: 0, tom: 0, crash: 0, snare: 0, kick: 0 },
    right: { hihat: 0, tom: 0, crash: 0, snare: 0, kick: 0 },
  };

  private activeZoneByHand: Record<HandSlot, DrumType | null> = {
    left: null,
    right: null,
  };

  private lastSeenTimeByHand: Record<HandSlot, number> = {
    left: 0,
    right: 0,
  };

  // Trajectory tracking for velocity calculation (dY / dt)
  private trajectoryByHand: Record<HandSlot, HandTrajectory> = {
    left: { lastY: 50, lastTime: 0, downwardSpeed: 0, isMovingDown: false },
    right: { lastY: 50, lastTime: 0, downwardSpeed: 0, isMovingDown: false },
  };

  private mirror = true;
  private minTriggerCooldownMs = 80; // Ultra snappy 80ms per hand

  private state: TrackingState = {
    isStreaming: false,
    isInitializing: false,
    permissionGranted: false,
    error: null,
    leftHand: { x: 30, y: 50, isActive: false, velocity: 0.8 },
    rightHand: { x: 70, y: 50, isActive: false, velocity: 0.8 },
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
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
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
      numHands: 2, // Enable simultaneous 2 hands
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
        return 'Camera permission was blocked. Allow camera access in your browser and try again.';
      }
      if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        return 'No usable camera was found. Please check the selected device in Settings.';
      }
      if (error.name === 'NotReadableError' || error.name === 'AbortError') {
        return 'The webcam is in use by another application. Close other apps and try again.';
      }
    }

    const message = error instanceof Error ? error.message : '';
    return message || 'Could not start the webcam. Please check browser permissions and try again.';
  }

  private resetFingerTracking() {
    this.activeZoneByHand = { left: null, right: null };
    this.lastSeenTimeByHand = { left: 0, right: 0 };
    this.trajectoryByHand = {
      left: { lastY: 50, lastTime: 0, downwardSpeed: 0, isMovingDown: false },
      right: { lastY: 50, lastTime: 0, downwardSpeed: 0, isMovingDown: false },
    };
  }

  public triggerManualHit(drum: DrumType, velocity: number = 0.85) {
    const zone = drumLayoutService.getZone(drum);
    const x = zone.x + zone.width / 2;
    const y = zone.y + zone.height / 2;
    this.onHitListeners.forEach((cb) => cb(drum, velocity, x, y));
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

      // Keep both detected hands separate even if MediaPipe temporarily misidentifies labels
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
      if (timestamp - this.lastSeenTimeByHand[slot] > LOST_HAND_GRACE_MS) {
        this.activeZoneByHand[slot] = null;
      }
      const previousPosition = slot === 'left' ? this.state.leftHand : this.state.rightHand;
      return { ...previousPosition, isActive: false };
    }

    this.lastSeenTimeByHand[slot] = timestamp;
    const currentZone = this.getZoneAtPosition(tip.x, tip.y);
    const previousZone = this.activeZoneByHand[slot];

    // Calculate Y-velocity (speed of downward movement)
    const traj = this.trajectoryByHand[slot];
    let computedVelocity = 0.85;

    if (traj.lastTime > 0) {
      const dt = Math.max(0.005, (timestamp - traj.lastTime) / 1000); // in seconds
      const dy = tip.y - traj.lastY; // positive = downward motion in %
      const speed = dy / dt; // % per second

      traj.downwardSpeed = speed;
      traj.isMovingDown = speed > 15;

      // Map downward speed to strike velocity:
      // Normal stroke: 60 - 200 %/s -> velocity 0.6 - 1.0
      // Fast hard strike: > 280 %/s -> velocity 1.1 - 1.2
      // Light tap: < 40 %/s -> velocity 0.4
      if (speed > 10) {
        const normalized = Math.min(1.2, Math.max(0.35, 0.45 + (speed / 280) * 0.65));
        computedVelocity = Math.round(normalized * 100) / 100;
      }
    }

    traj.lastY = tip.y;
    traj.lastTime = timestamp;

    if (currentZone) {
      // Ensure zone energy is at least 45% when finger is inside so visual targeting is immediate and robust
      zoneEnergies[currentZone] = Math.min(
        100,
        Math.max(zoneEnergies[currentZone], 45, computedVelocity * 100)
      );
    }

    // Trigger on zone entry OR downward strike / deliberate finger tap within current zone
    const sinceLastHit = timestamp - this.lastTriggerTimeByHand[slot][currentZone ?? 'kick'];
    const isNewZone = currentZone && currentZone !== previousZone;
    const isDownwardReStrike =
      currentZone &&
      currentZone === previousZone &&
      (traj.downwardSpeed > 20 || (traj.isMovingDown && traj.downwardSpeed > 14)) &&
      sinceLastHit > this.minTriggerCooldownMs;

    if (currentZone && (isNewZone || isDownwardReStrike)) {
      if (sinceLastHit > this.minTriggerCooldownMs) {
        this.lastTriggerTimeByHand[slot][currentZone] = timestamp;
        this.onHitListeners.forEach((cb) => cb(currentZone, computedVelocity, tip.x, tip.y, slot));
      }
    }

    this.activeZoneByHand[slot] = currentZone;
    return { ...tip, isActive: true, velocity: computedVelocity };
  }

  private getZoneAtPosition(x: number, y: number): DrumType | null {
    for (const drum of DRUMS) {
      const zone = drumLayoutService.getZone(drum.id);
      if (
        x >= zone.x &&
        x <= zone.x + zone.width &&
        y >= zone.y &&
        y <= zone.y + zone.height
      ) {
        return drum.id;
      }
    }
    return null;
  }

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
