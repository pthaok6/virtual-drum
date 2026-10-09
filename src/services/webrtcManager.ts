/**
 * WebRTC Peer-to-Peer Manager for Live Rooms
 * Enables real-time microphone voice chat, screen sharing, and webcam video between participants
 */

export type RemoteStreamCallback = (peerId: string, type: 'screen' | 'camera' | 'audio', stream: MediaStream | null) => void;

interface WebRTCSignalPayload {
  roomId: string;
  from: string;
  to: string;
  signal: {
    type: 'offer' | 'answer' | 'candidate';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

class WebRTCManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localAudioStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private localCameraStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private streamCallbacks: Set<RemoteStreamCallback> = new Set();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  /**
   * Initialize WebRTC for the active room session
   */
  public init(roomId: string, userId: string) {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
  }

  /**
   * Close all peer connections and release media
   */
  public destroy() {
    this.peers.forEach((peer) => {
      try {
        peer.close();
      } catch {}
    });
    this.peers.clear();

    this.remoteAudioElements.forEach((audio) => {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {}
    });
    this.remoteAudioElements.clear();

    this.localAudioStream = null;
    this.localScreenStream = null;
    this.localCameraStream = null;
    this.currentRoomId = null;
    this.currentUserId = null;
    this.pendingCandidates.clear();
  }

  /**
   * Register a callback to receive remote media streams (screen share, camera, etc.)
   */
  public onRemoteStream(callback: RemoteStreamCallback): () => void {
    this.streamCallbacks.add(callback);
    return () => {
      this.streamCallbacks.delete(callback);
    };
  }

  private notifyRemoteStream(peerId: string, type: 'screen' | 'camera' | 'audio', stream: MediaStream | null) {
    this.streamCallbacks.forEach((cb) => {
      try {
        cb(peerId, type, stream);
      } catch (err) {
        console.warn('Remote stream callback error:', err);
      }
    });
  }

  /**
   * Set or update local microphone audio stream
   */
  public async setLocalAudioStream(stream: MediaStream | null) {
    this.localAudioStream = stream;
    const audioTrack = stream ? stream.getAudioTracks()[0] : null;

    for (const [peerId, peer] of this.peers.entries()) {
      const senders = peer.getSenders();
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (audioSender) {
        audioSender.replaceTrack(audioTrack || null).catch(() => {});
      } else if (audioTrack) {
        try {
          peer.addTrack(audioTrack, stream!);
          this.renegotiatePeer(peerId, peer);
        } catch {}
      }
    }
  }

  /**
   * Set or update local screen sharing stream
   */
  public async setLocalScreenStream(stream: MediaStream | null) {
    this.localScreenStream = stream;
    const videoTrack = stream ? stream.getVideoTracks()[0] : null;

    for (const [peerId, peer] of this.peers.entries()) {
      const senders = peer.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (videoSender) {
        if (videoTrack) {
          videoSender.replaceTrack(videoTrack).catch(() => {});
        } else {
          videoSender.replaceTrack(null).catch(() => {});
        }
      } else if (videoTrack) {
        try {
          peer.addTrack(videoTrack, stream!);
          // Renegotiate with peer
          this.renegotiatePeer(peerId, peer);
        } catch {}
      }
    }
  }

  /**
   * Set or update local camera stream
   */
  public async setLocalCameraStream(stream: MediaStream | null) {
    this.localCameraStream = stream;
    const videoTrack = stream ? stream.getVideoTracks()[0] : null;

    for (const [peerId, peer] of this.peers.entries()) {
      const senders = peer.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (videoSender) {
        if (videoTrack) {
          videoSender.replaceTrack(videoTrack).catch(() => {});
        } else {
          videoSender.replaceTrack(null).catch(() => {});
        }
      } else if (videoTrack) {
        try {
          peer.addTrack(videoTrack, stream!);
          this.renegotiatePeer(peerId, peer);
        } catch {}
      }
    }
  }

  /**
   * Connect to a specific peer in the room
   */
  public async connectToPeer(peerId: string) {
    if (!this.currentUserId || peerId === this.currentUserId) return;
    if (this.peers.has(peerId)) return;

    // Polite / impolite peer ordering: deterministic initiator based on user ID comparison
    const isInitiator = this.currentUserId < peerId;
    const peer = this.createPeerConnection(peerId);

    if (isInitiator) {
      try {
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await peer.setLocalDescription(offer);
        this.sendSignal(peerId, { type: 'offer', sdp: offer });
      } catch (err) {
        console.warn(`Failed to create offer for peer ${peerId}:`, err);
      }
    }
  }

  private async renegotiatePeer(peerId: string, peer: RTCPeerConnection) {
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.sendSignal(peerId, { type: 'offer', sdp: offer });
    } catch (err) {
      console.warn(`Renegotiate failed for peer ${peerId}:`, err);
    }
  }

  /**
   * Remove a disconnected peer
   */
  public removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        peer.close();
      } catch {}
      this.peers.delete(peerId);
    }

    const audio = this.remoteAudioElements.get(peerId);
    if (audio) {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {}
      this.remoteAudioElements.delete(peerId);
    }

    this.pendingCandidates.delete(peerId);
    this.notifyRemoteStream(peerId, 'screen', null);
    this.notifyRemoteStream(peerId, 'camera', null);
  }

  public resumeAllAudio(): void {
    this.remoteAudioElements.forEach((audio) => {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    });
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const peer = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerId, peer);

    // Initialize audio and video transceivers upfront so SDP contains m-lines
    try {
      peer.addTransceiver('audio', { direction: 'sendrecv' });
      peer.addTransceiver('video', { direction: 'sendrecv' });
    } catch {}

    // Add local tracks if available
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((track) => {
        try {
          const sender = peer.getSenders().find((s) => s.track?.kind === 'audio');
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            peer.addTrack(track, this.localAudioStream!);
          }
        } catch {}
      });
    }

    if (this.localScreenStream) {
      this.localScreenStream.getVideoTracks().forEach((track) => {
        try {
          const sender = peer.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            peer.addTrack(track, this.localScreenStream!);
          }
        } catch {}
      });
    } else if (this.localCameraStream) {
      this.localCameraStream.getVideoTracks().forEach((track) => {
        try {
          const sender = peer.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            peer.addTrack(track, this.localCameraStream!);
          }
        } catch {}
      });
    }

    // ICE Candidate handler
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Track received handler
    peer.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);

      if (event.track.kind === 'audio') {
        // Play remote voice audio automatically
        let audioEl = this.remoteAudioElements.get(peerId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.muted = false;
          audioEl.volume = 1.0;
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          this.remoteAudioElements.set(peerId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.play().catch((err) => {
          console.warn(`Autoplay audio for ${peerId} requires interaction:`, err);
        });
        this.notifyRemoteStream(peerId, 'audio', stream);
      } else if (event.track.kind === 'video') {
        // Video can be screen share or camera
        this.notifyRemoteStream(peerId, 'screen', stream);
        this.notifyRemoteStream(peerId, 'camera', stream);
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    return peer;
  }

  /**
   * Handle incoming WebRTC signaling message
   */
  public async handleSignal(
    from: string,
    signal: { type: 'offer' | 'answer' | 'candidate'; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
  ) {
    if (!this.currentUserId || from === this.currentUserId) return;

    let peer = this.peers.get(from);
    if (!peer) {
      peer = this.createPeerConnection(from);
    }

    try {
      if (signal.type === 'offer' && signal.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Flush any queued ICE candidates
        const queued = this.pendingCandidates.get(from) || [];
        for (const cand of queued) {
          await peer.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        this.pendingCandidates.delete(from);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        this.sendSignal(from, { type: 'answer', sdp: answer });
      } else if (signal.type === 'answer' && signal.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        const queued = this.pendingCandidates.get(from) || [];
        for (const cand of queued) {
          await peer.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        this.pendingCandidates.delete(from);
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (peer.remoteDescription && peer.remoteDescription.type) {
          await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          // Queue candidate until remote description is set
          const list = this.pendingCandidates.get(from) || [];
          list.push(signal.candidate);
          this.pendingCandidates.set(from, list);
        }
      }
    } catch (err) {
      console.warn(`WebRTC signal handling error from ${from}:`, err);
    }
  }

  private sendSignal(
    to: string,
    signal: { type: 'offer' | 'answer' | 'candidate'; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
  ) {
    if (!this.currentRoomId || !this.currentUserId) return;

    fetch(`/api/live-rooms/${this.currentRoomId}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: this.currentRoomId,
        from: this.currentUserId,
        to,
        signal,
      }),
    }).catch(() => {});
  }
}

export const webrtcManager = new WebRTCManager();
