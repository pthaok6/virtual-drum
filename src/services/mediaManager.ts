export interface MediaLevelCallback {
  (volume: number, isSpeaking: boolean): void;
}

class MediaManager {
  private micStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private levelCallbacks: Set<MediaLevelCallback> = new Set();

  /**
   * Start microphone audio capture and analyze audio level
   */
  public async startMicrophone(): Promise<MediaStream> {
    if (this.micStream) return this.micStream;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    this.micStream = stream;
    this.setupAudioAnalysis(stream);
    return stream;
  }

  public stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.cleanupAudioAnalysis();
  }

  public isMicActive(): boolean {
    return Boolean(this.micStream && this.micStream.getAudioTracks().some((t) => t.enabled));
  }

  public setMicMuted(muted: boolean): void {
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
  }

  /**
   * Start camera video stream
   */
  public async startCamera(): Promise<MediaStream> {
    if (this.cameraStream) return this.cameraStream;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
      audio: false,
    });
    this.cameraStream = stream;
    return stream;
  }

  public stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = null;
    }
  }

  public isCameraActive(): boolean {
    return Boolean(this.cameraStream && this.cameraStream.getVideoTracks().some((t) => t.enabled));
  }

  /**
   * Start display screen capture
   */
  public async startScreenShare(onEnded?: () => void): Promise<MediaStream> {
    if (this.screenStream) return this.screenStream;

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
      },
      audio: true,
    });

    this.screenStream = stream;

    // Listen to user ending screen share via native browser floating banner
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stopScreenShare();
        if (onEnded) onEnded();
      };
    }

    return stream;
  }

  public stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
  }

  public isScreenSharing(): boolean {
    return Boolean(this.screenStream && this.screenStream.getVideoTracks().some((t) => t.enabled));
  }

  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  public getCameraStream(): MediaStream | null {
    return this.cameraStream;
  }

  public getMicStream(): MediaStream | null {
    return this.micStream;
  }

  /**
   * Subscribe to local microphone speaking volume levels (0..100)
   */
  public onAudioLevel(callback: MediaLevelCallback): () => void {
    this.levelCallbacks.add(callback);
    return () => {
      this.levelCallbacks.delete(callback);
    };
  }

  private setupAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        const isSpeaking = normalized > 12;

        this.levelCallbacks.forEach((cb) => {
          try {
            cb(normalized, isSpeaking);
          } catch {}
        });

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      this.animFrameId = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn('Audio analysis not supported in this environment:', e);
    }
  }

  private cleanupAudioAnalysis() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  public stopAll(): void {
    this.stopMicrophone();
    this.stopCamera();
    this.stopScreenShare();
  }
}

export const mediaManager = new MediaManager();
