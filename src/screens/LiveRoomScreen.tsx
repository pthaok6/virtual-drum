import React, { useState, useEffect, useRef } from 'react';
import { LiveRoom, RoomMember, RoomChatMessage, DrumType, DrumHitBroadcast } from '../types';
import { roomService } from '../services/roomService';
import { mediaManager } from '../services/mediaManager';
import { webrtcManager } from '../services/webrtcManager';
import { audioEngine } from '../services/audio';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Send,
  LogOut,
  Crown,
  Shield,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  UserX,
  Settings,
  Smile,
  Music,
  Maximize2,
  Minimize2,
  Radio,
  Flame,
  ThumbsUp,
  Heart,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface LiveRoomScreenProps {
  roomId: string;
  onLeaveRoom: () => void;
}

const DRUM_PADS: { id: DrumType; name: string; key: string; color: string }[] = [
  { id: 'kick', name: 'Bass Kick', key: 'Space', color: 'from-rose-500 to-red-600' },
  { id: 'snare', name: 'Snare', key: 'J', color: 'from-amber-500 to-orange-600' },
  { id: 'hihat', name: 'Hi-Hat', key: 'K', color: 'from-emerald-500 to-teal-600' },
  { id: 'tom', name: 'Tom', key: 'U', color: 'from-sky-500 to-blue-600' },
  { id: 'crash', name: 'Crash Cymbal', key: 'I', color: 'from-purple-500 to-pink-600' },
];

const EMOJI_REACTIONS = ['🥁', '🔥', '👏', '🤘', '❤️', '⚡'];

export const LiveRoomScreen: React.FC<LiveRoomScreenProps> = ({ roomId, onLeaveRoom }) => {
  const { user } = useAuth();
  const [room, setRoom] = useState<LiveRoom | null>(() => roomService.getRoom(roomId));
  const [messages, setMessages] = useState<RoomChatMessage[]>(() => roomService.getMessages(roomId));
  const [chatInput, setChatInput] = useState('');

  // Media states for local user
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);

  // WebRTC remote streams from peers
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<{ [peerId: string]: MediaStream }>({});

  // Active hit visual feedback (map of memberId or drum to timestamp)
  const [lastDrumHits, setLastDrumHits] = useState<{ [drum: string]: number }>({});
  const [recentMemberHits, setRecentMemberHits] = useState<{ [memberId: string]: string }>({});

  // Owner management modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomDescInput, setRoomDescInput] = useState('');
  const [roomLockedInput, setRoomLockedInput] = useState(false);

  // Screen share video element ref
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const isOwner = Boolean(user && room && room.ownerId === user.id);
  const currentMember = room?.members.find((m) => m.id === user?.id);

  // WebRTC initialization and peer connection setup
  useEffect(() => {
    if (!user) return;
    webrtcManager.init(roomId, user.id);

    const unsubSignal = roomService.onWebRTCSignal((data) => {
      if (data.roomId === roomId && data.to === user.id) {
        webrtcManager.handleSignal(data.from, data.signal);
      }
    });

    const unsubStreams = webrtcManager.onRemoteStream((peerId, type, stream) => {
      if (type === 'screen') {
        setRemoteScreenStream(stream);
      } else if (type === 'camera') {
        setRemoteCameraStreams((prev) => {
          if (!stream) {
            const next = { ...prev };
            delete next[peerId];
            return next;
          }
          return { ...prev, [peerId]: stream };
        });
      }
    });

    return () => {
      unsubSignal();
      unsubStreams();
      webrtcManager.destroy();
    };
  }, [roomId, user?.id]);

  // Connect to peers as room members list changes
  useEffect(() => {
    if (!user || !room) return;
    const otherMembers = (room.members || []).filter((m) => m && m.id !== user.id);
    otherMembers.forEach((m) => {
      webrtcManager.connectToPeer(m.id);
    });
  }, [room?.members, user?.id]);

  // Active sync heartbeat to guarantee instant cross-browser synchronization
  useEffect(() => {
    const syncInterval = setInterval(() => {
      roomService.fetchRoomFromServer(roomId).then((serverRoom) => {
        if (serverRoom) {
          setRoom((prev) => {
            if (
              !prev ||
              prev.updatedAt !== serverRoom.updatedAt ||
              prev.members.length !== serverRoom.members.length ||
              prev.activeScreenShareUser !== serverRoom.activeScreenShareUser ||
              JSON.stringify(prev.members) !== JSON.stringify(serverRoom.members)
            ) {
              return serverRoom;
            }
            return prev;
          });
        }
      });
      roomService.fetchMessagesFromServer(roomId);
    }, 1200);

    return () => clearInterval(syncInterval);
  }, [roomId]);

  // Subscribe to room updates & messages
  useEffect(() => {
    let hasLoadedRoom = Boolean(roomService.getRoom(roomId));

    const unsubRoom = roomService.subscribeRoom(roomId, (updatedRoom, updatedMessages) => {
      if (!updatedRoom) {
        if (hasLoadedRoom) {
          alert('Room has ended or no longer exists.');
          onLeaveRoom();
        }
        return;
      }
      hasLoadedRoom = true;
      setRoom(updatedRoom);
      setMessages(updatedMessages);
    });

    const unsubKicked = roomService.onKicked(roomId, (kickedUserId) => {
      if (user && kickedUserId === user.id) {
        alert('You have been removed from the room by the host.');
        onLeaveRoom();
      }
    });

    const unsubDrum = roomService.onDrumHit(roomId, (hit: DrumHitBroadcast) => {
      // Trigger audio if not self (self plays locally immediately)
      if (user && hit.senderId !== user.id) {
        audioEngine.playDrum(hit.drum, hit.velocity);
      }

      // Visual flash
      setLastDrumHits((prev) => ({ ...prev, [hit.drum]: Date.now() }));
      setRecentMemberHits((prev) => ({ ...prev, [hit.senderId]: hit.drum }));

      // Clear member hit indicator after 1.2s
      setTimeout(() => {
        setRecentMemberHits((prev) => {
          if (prev[hit.senderId] === hit.drum) {
            const next = { ...prev };
            delete next[hit.senderId];
            return next;
          }
          return prev;
        });
      }, 1200);
    });

    return () => {
      unsubRoom();
      unsubKicked();
      unsubDrum();
    };
  }, [roomId, user, onLeaveRoom]);

  // Continuously maintain presence state across all browsers
  useEffect(() => {
    if (room && currentMember) {
      roomService.syncPresence(room, currentMember);
    }
  }, [room, currentMember]);

  // Sync state if owner muting local user from afar
  useEffect(() => {
    if (currentMember) {
      if (currentMember.isMuted && isMicOn) {
        mediaManager.setMicMuted(true);
        setIsMicOn(false);
      }
    }
  }, [currentMember?.isMuted]);

  // Audio level meter listener
  useEffect(() => {
    const unsubAudio = mediaManager.onAudioLevel((level, isSpeaking) => {
      setLocalAudioLevel(level);
      if (user && isMicOn) {
        roomService.updateMediaState(roomId, user.id, {
          isSpeaking,
          audioLevel: level,
        });
      }
    });

    return () => unsubAudio();
  }, [roomId, user, isMicOn]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Keyboard controls for drums
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in chat input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      let hitDrum: DrumType | null = null;
      if (e.code === 'Space') {
        e.preventDefault();
        hitDrum = 'kick';
      } else if (e.key === 'j' || e.key === 'J') {
        hitDrum = 'snare';
      } else if (e.key === 'k' || e.key === 'K') {
        hitDrum = 'hihat';
      } else if (e.key === 'u' || e.key === 'U') {
        hitDrum = 'tom';
      } else if (e.key === 'i' || e.key === 'I') {
        hitDrum = 'crash';
      }

      if (hitDrum && user) {
        handleTriggerDrum(hitDrum);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, roomId]);

  // Clean up media on unmount
  useEffect(() => {
    return () => {
      mediaManager.stopMicrophone();
      mediaManager.stopCamera();
      mediaManager.stopScreenShare();
    };
  }, []);

  // Update screen video stream attachment (local presenter OR remote presenter)
  useEffect(() => {
    if (screenVideoRef.current) {
      if (isScreenSharing) {
        const activeStream = mediaManager.getScreenStream();
        if (activeStream && screenVideoRef.current.srcObject !== activeStream) {
          screenVideoRef.current.srcObject = activeStream;
        }
      } else if (remoteScreenStream) {
        if (screenVideoRef.current.srcObject !== remoteScreenStream) {
          screenVideoRef.current.srcObject = remoteScreenStream;
        }
      } else {
        screenVideoRef.current.srcObject = null;
      }
    }
  }, [isScreenSharing, remoteScreenStream, room?.activeScreenShareUser]);

  // Update local camera video stream attachment
  useEffect(() => {
    if (cameraVideoRef.current) {
      const cameraStream = mediaManager.getCameraStream();
      if (cameraStream && cameraVideoRef.current.srcObject !== cameraStream) {
        cameraVideoRef.current.srcObject = cameraStream;
      }
    }
  }, [isCameraOn]);

  // ================= MEDIA ACTIONS =================

  const handleToggleMic = async () => {
    if (!user) return;
    try {
      if (isMicOn) {
        mediaManager.setMicMuted(true);
        webrtcManager.setLocalAudioStream(null);
        setIsMicOn(false);
        roomService.updateMediaState(roomId, user.id, {
          isMuted: true,
          isSpeaking: false,
          audioLevel: 0,
        });
      } else {
        const stream = await mediaManager.startMicrophone();
        mediaManager.setMicMuted(false);
        webrtcManager.setLocalAudioStream(stream);
        setIsMicOn(true);
        roomService.updateMediaState(roomId, user.id, {
          isMuted: false,
        });
      }
    } catch (err) {
      console.error('Error toggling mic:', err);
      alert('Cannot access microphone. Please check browser permissions.');
    }
  };

  const handleToggleCamera = async () => {
    if (!user) return;
    try {
      if (isCameraOn) {
        mediaManager.stopCamera();
        webrtcManager.setLocalCameraStream(null);
        setIsCameraOn(false);
        roomService.updateMediaState(roomId, user.id, { isCameraOn: false });
      } else {
        const stream = await mediaManager.startCamera();
        webrtcManager.setLocalCameraStream(stream);
        setIsCameraOn(true);
        roomService.updateMediaState(roomId, user.id, { isCameraOn: true });
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.error('Error toggling camera:', err);
      alert('Cannot access camera. Please check browser permissions.');
    }
  };

  const handleToggleScreenShare = async () => {
    if (!user) return;
    try {
      if (isScreenSharing) {
        mediaManager.stopScreenShare();
        webrtcManager.setLocalScreenStream(null);
        setIsScreenSharing(false);
        roomService.updateMediaState(roomId, user.id, { isScreenSharing: false });
      } else {
        // Check if someone else is already sharing
        if (room?.activeScreenShareUser && room.activeScreenShareUser !== user.id) {
          const presenter = (room?.members || []).find((m) => m && m.id === room.activeScreenShareUser);
          alert(`${presenter?.username || 'Another participant'} is currently sharing screen. Please wait until they finish!`);
          return;
        }

        const stream = await mediaManager.startScreenShare(() => {
          setIsScreenSharing(false);
          webrtcManager.setLocalScreenStream(null);
          if (user) {
            roomService.updateMediaState(roomId, user.id, { isScreenSharing: false });
          }
        });

        webrtcManager.setLocalScreenStream(stream);
        setIsScreenSharing(true);
        roomService.updateMediaState(roomId, user.id, { isScreenSharing: true });

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  // ================= DRUM ACTIONS =================

  const handleTriggerDrum = (drum: DrumType) => {
    if (!user) return;
    audioEngine.playDrum(drum, 0.85);
    roomService.broadcastDrumHit(roomId, user, drum, 0.85);

    setLastDrumHits((prev) => ({ ...prev, [drum]: Date.now() }));
    setRecentMemberHits((prev) => ({ ...prev, [user.id]: drum }));
  };

  // ================= CHAT ACTIONS =================

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !chatInput.trim()) return;

    roomService.sendMessage(roomId, user, chatInput.trim(), 'chat');
    setChatInput('');
  };

  const handleSendReaction = (emoji: string) => {
    if (!user) return;
    roomService.sendMessage(roomId, user, emoji, 'reaction');
  };

  // ================= OWNER ACTIONS =================

  const handleKickMember = (targetUserId: string, targetName: string) => {
    if (!isOwner || !user) return;
    if (confirm(`Are you sure you want to remove "${targetName}" from the room?`)) {
      roomService.kickMember(roomId, user.id, targetUserId);
    }
  };

  const handleToggleMuteMember = (targetUserId: string, currentMute: boolean) => {
    if (!isOwner || !user) return;
    roomService.toggleMuteMember(roomId, user.id, targetUserId, !currentMute);
  };

  const handleOpenRoomSettings = () => {
    if (!room) return;
    setRoomNameInput(room.name);
    setRoomDescInput(room.description || '');
    setRoomLockedInput(room.isLocked);
    setIsSettingsOpen(true);
  };

  const handleSaveRoomSettings = () => {
    if (!isOwner || !user) return;
    roomService.updateRoomSettings(roomId, user.id, {
      name: roomNameInput,
      description: roomDescInput,
      isLocked: roomLockedInput,
    });
    setIsSettingsOpen(false);
  };

  const handleEndRoom = () => {
    if (!isOwner || !user) return;
    if (
      confirm(
        '⚠️ Are you sure you want to end this room? All participants will be disconnected immediately.'
      )
    ) {
      roomService.endRoom(roomId, user.id);
      onLeaveRoom();
    }
  };

  const handleLeaveRoom = () => {
    if (user) {
      roomService.leaveRoom(roomId, user.id);
    }
    onLeaveRoom();
  };

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Radio className="h-12 w-12 text-rose-500 animate-pulse mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Loading room information...</h2>
        <Button onClick={onLeaveRoom} variant="outline" className="border-zinc-700 text-zinc-300">
          Back to Rooms Lobby
        </Button>
      </div>
    );
  }

  const membersList = Array.isArray(room?.members) ? room.members.filter(Boolean) : [];
  const presenterMember = membersList.find((m) => m && m.id === room?.activeScreenShareUser);
  const isSomeoneScreenSharing = Boolean(room?.activeScreenShareUser);

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-zinc-100 min-h-screen">
      {/* Top Header Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Room Info */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 to-rose-500 shadow-md shadow-rose-500/20">
              <Radio className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white leading-tight">{room.name}</h1>
                <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] uppercase font-bold">
                  {room.genre}
                </Badge>
                {room.isLocked && (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Locked
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  Host: <strong className="text-zinc-200">{room.ownerName}</strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-zinc-400" />
                  {membersList.length}/{room.maxMembers || 8} participants
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons on header */}
          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenRoomSettings}
                  className="border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs flex items-center gap-1.5"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Room Settings</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEndRoom}
                  className="border-rose-900/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 text-xs flex items-center gap-1.5"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>End Room</span>
                </Button>
              </>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={handleLeaveRoom}
              className="bg-red-600/90 hover:bg-red-600 text-white text-xs flex items-center gap-1.5 shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Leave Room</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Jam Studio Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left & Center: Screen share / Stage + Participants grid + Drum pads */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Main Visual Stage: Screen Share OR Visualizer */}
          {isSomeoneScreenSharing ? (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/90 shadow-2xl aspect-video max-h-[500px] flex items-center justify-center">
              {/* Screen Video Element */}
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted={isScreenSharing}
                className="w-full h-full object-contain bg-black"
              />

              {/* Presenter Info Overlay */}
              <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-md border border-zinc-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <MonitorUp className="h-4 w-4 text-sky-400 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-200">
                  {presenterMember
                    ? `${presenterMember.username} is sharing screen`
                    : 'Sharing screen'}
                </span>
                {presenterMember?.id === user?.id && (
                  <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px] px-1.5 py-0">
                    You
                  </Badge>
                )}
              </div>

              {/* Stop Share button if current user is presenter */}
              {isScreenSharing && (
                <div className="absolute top-3 right-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleToggleScreenShare}
                    className="text-xs h-8 flex items-center gap-1.5 bg-red-600/90 hover:bg-red-600 shadow-md"
                  >
                    <MonitorOff className="h-3.5 w-3.5" />
                    <span>Stop Sharing</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Stage Visualizer Banner when no screen share */
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-purple-950/30 p-6 flex flex-col items-center justify-center text-center min-h-[220px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1)_0%,transparent_70%)] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center max-w-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-rose-500 text-white shadow-xl shadow-purple-500/20 mb-3">
                  <Music className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-white">Live Jam Stage</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Turn on your mic, jam on drums, and share your screen with everyone in the room!
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleScreenShare}
                    className="border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:text-white hover:bg-zinc-700 text-xs flex items-center gap-1.5"
                  >
                    <MonitorUp className="h-3.5 w-3.5 text-sky-400" />
                    <span>Share Screen</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Participants Grid */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                <h3 className="font-semibold text-sm text-zinc-200">
                  Room Members ({membersList.length})
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400">
                {isOwner
                  ? '👑 You are Host: full moderation controls to mute or remove members'
                  : 'Live Jamming'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {membersList.map((member) => {
                const isSelf = member.id === user?.id;
                const isMemberOwner = member.role === 'owner';
                const hasRecentHit = recentMemberHits[member.id];

                return (
                  <div
                    key={member.id}
                    className={`relative rounded-xl border p-3 flex flex-col items-center text-center transition-all duration-200 ${
                      member.isSpeaking
                        ? 'border-emerald-500/80 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                        : hasRecentHit
                        ? 'border-rose-500/80 bg-rose-950/20 shadow-lg shadow-rose-500/10'
                        : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
                    }`}
                  >
                    {/* Floating Drum Hit Animation Tag */}
                    {hasRecentHit && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-bounce">
                        🥁 {hasRecentHit.toUpperCase()}!
                      </div>
                    )}

                    {/* Camera Feed OR Avatar */}
                    <div className="relative mb-2">
                      {isSelf && isCameraOn ? (
                        <div className="h-16 w-16 rounded-xl overflow-hidden border-2 border-purple-500 relative bg-black">
                          <video
                            ref={cameraVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : !isSelf && member.isCameraOn && remoteCameraStreams[member.id] ? (
                        <div className="h-16 w-16 rounded-xl overflow-hidden border-2 border-sky-500 relative bg-black">
                          <video
                            ref={(el) => {
                              if (el && el.srcObject !== remoteCameraStreams[member.id]) {
                                el.srcObject = remoteCameraStreams[member.id];
                              }
                            }}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <img
                          src={member.avatarUrl}
                          alt={member.username}
                          className={`h-16 w-16 rounded-xl border-2 bg-zinc-950 p-0.5 object-cover transition-all ${
                            member.isSpeaking
                              ? 'border-emerald-400 ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-zinc-900'
                              : isMemberOwner
                              ? 'border-amber-400/80'
                              : 'border-zinc-700'
                          }`}
                        />
                      )}

                      {/* Speaking waveform badge */}
                      {member.isSpeaking && (
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-zinc-950 p-1 rounded-full shadow-md animate-pulse">
                          <Mic className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                      {member.isMuted && (
                        <div className="absolute -bottom-1 -right-1 bg-zinc-800 text-rose-400 p-1 rounded-full border border-zinc-700 shadow-md">
                          <MicOff className="h-3 w-3" />
                        </div>
                      )}
                    </div>

                    {/* Username & Level */}
                    <div className="w-full">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold text-xs text-white truncate max-w-[100px]">
                          {member.username}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] text-zinc-400 font-normal">(You)</span>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        {isMemberOwner ? (
                          <Badge className="bg-amber-400/10 text-amber-300 border-amber-400/30 text-[9px] px-1.5 py-0 flex items-center gap-1">
                            <Crown className="h-2.5 w-2.5" /> Host
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[9px] px-1.5 py-0">
                            Member
                          </Badge>
                        )}
                        <span className="text-[10px] text-zinc-400">Lv.{member.level}</span>
                      </div>
                    </div>

                    {/* Indicators: Camera & Screen sharing */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {member.isCameraOn ? (
                        <Video className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <VideoOff className="h-3.5 w-3.5 text-zinc-600" />
                      )}
                      {member.isScreenSharing && (
                        <MonitorUp className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                      )}
                    </div>

                    {/* Owner Moderation Controls (Only visible to owner, targeting other members) */}
                    {isOwner && !isSelf && (
                      <div className="w-full mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleMuteMember(member.id, member.isMuted)}
                          title={member.isMuted ? 'Unmute member' : 'Mute member'}
                          className={`p-1 rounded-lg border text-xs transition-colors cursor-pointer ${
                            member.isMuted
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'
                          }`}
                        >
                          {member.isMuted ? (
                            <Volume2 className="h-3.5 w-3.5" />
                          ) : (
                            <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKickMember(member.id, member.username)}
                          title="Remove from room"
                          className="p-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Mini Drum Pads */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-rose-400" />
                <h3 className="font-semibold text-sm text-zinc-200">Interactive Jam Drum Pads</h3>
              </div>
              <span className="text-[11px] text-zinc-400">
                Click pads or press keys: <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">Space</kbd>, <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">J</kbd>, <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">K</kbd>, <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">U</kbd>, <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">I</kbd>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {DRUM_PADS.map((pad) => {
                const isRecentlyHit =
                  lastDrumHits[pad.id] && Date.now() - lastDrumHits[pad.id] < 250;
                return (
                  <button
                    key={pad.id}
                    type="button"
                    onClick={() => handleTriggerDrum(pad.id)}
                    className={`relative rounded-xl border p-3 flex flex-col items-center justify-center transition-all duration-100 cursor-pointer select-none active:scale-95 ${
                      isRecentlyHit
                        ? `bg-gradient-to-t ${pad.color} border-white shadow-lg text-white scale-98`
                        : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700 hover:bg-zinc-800/90 text-zinc-200'
                    }`}
                  >
                    <span className="font-bold text-xs">{pad.name}</span>
                    <span className="text-[10px] text-zinc-400 mt-1 font-mono">[{pad.key}]</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Control Toolbar */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md p-3 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            {/* Mic Toggle */}
            <Button
              variant={isMicOn ? 'default' : 'outline'}
              onClick={handleToggleMic}
              className={`rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-all ${
                isMicOn
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {isMicOn ? (
                <>
                  <Mic className="h-4 w-4 animate-pulse text-white" />
                  <span>Mic Active</span>
                </>
              ) : (
                <>
                  <MicOff className="h-4 w-4 text-rose-400" />
                  <span>Turn On Mic</span>
                </>
              )}
            </Button>

            {/* Camera Toggle */}
            <Button
              variant={isCameraOn ? 'default' : 'outline'}
              onClick={handleToggleCamera}
              className={`rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-all ${
                isCameraOn
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {isCameraOn ? (
                <>
                  <Video className="h-4 w-4 text-white" />
                  <span>Camera Active</span>
                </>
              ) : (
                <>
                  <VideoOff className="h-4 w-4 text-zinc-400" />
                  <span>Turn On Camera</span>
                </>
              )}
            </Button>

            {/* Screen Share Toggle */}
            <Button
              variant={isScreenSharing ? 'default' : 'outline'}
              onClick={handleToggleScreenShare}
              className={`rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-all ${
                isScreenSharing
                  ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {isScreenSharing ? (
                <>
                  <MonitorOff className="h-4 w-4 text-white" />
                  <span>Stop Sharing</span>
                </>
              ) : (
                <>
                  <MonitorUp className="h-4 w-4 text-sky-400" />
                  <span>Share Screen</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Sidebar: Live Chat & Reactions */}
        <div className="flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden h-[600px] lg:h-auto">
          {/* Chat Header */}
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smile className="h-4 w-4 text-purple-400" />
              <h3 className="font-semibold text-sm text-zinc-200">Live Room Chat</h3>
            </div>
            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]">
              {messages.length} messages
            </Badge>
          </div>

          {/* Quick Reaction Bar */}
          <div className="px-3 py-2 border-b border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between gap-1">
            {EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSendReaction(emoji)}
                className="h-8 w-8 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 hover:scale-110 active:scale-95 flex items-center justify-center text-sm transition-all cursor-pointer"
                title={`Send ${emoji} reaction`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div
            ref={chatScrollRef}
            className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs font-sans"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 p-4">
                <Smile className="h-8 w-8 mb-2 opacity-50" />
                <p>No messages yet.</p>
                <p className="text-[11px]">Say hello to everyone in the room!</p>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.type === 'system') {
                  return (
                    <div
                      key={msg.id}
                      className="rounded-lg bg-zinc-950/60 border border-zinc-800/60 px-2.5 py-1.5 text-center text-[11px] text-zinc-400 italic"
                    >
                      {msg.content}
                    </div>
                  );
                }

                if (msg.type === 'reaction') {
                  return (
                    <div
                      key={msg.id}
                      className="flex items-center gap-2 bg-purple-950/20 border border-purple-500/20 rounded-xl px-2.5 py-1.5"
                    >
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        className="h-5 w-5 rounded-md bg-zinc-950"
                      />
                      <span className="font-semibold text-zinc-300 text-[11px]">
                        {msg.senderName}:
                      </span>
                      <span className="text-lg">{msg.content}</span>
                    </div>
                  );
                }

                const isMe = msg.senderId === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      className="h-6 w-6 rounded-lg bg-zinc-950 border border-zinc-700 shrink-0 mt-0.5"
                    />
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                        isMe
                          ? 'bg-rose-600 text-white rounded-tr-none'
                          : 'bg-zinc-800 text-zinc-200 border border-zinc-700/60 rounded-tl-none'
                      }`}
                    >
                      {!isMe && (
                        <div className="font-bold text-[10px] text-zinc-400 mb-0.5">
                          {msg.senderName}
                        </div>
                      )}
                      <p className="break-words leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-zinc-800 bg-zinc-900/80 flex items-center gap-2"
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="h-9 bg-zinc-950 border-zinc-700 text-xs text-white placeholder:text-zinc-500 focus-visible:ring-purple-500"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!chatInput.trim()}
              className="h-9 px-3 bg-purple-600 hover:bg-purple-500 text-white shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Owner Settings Dialog */}
      {isOwner && (
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white text-lg">
                <Crown className="h-5 w-5 text-amber-400" />
                Room Settings (Host)
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Update room details or toggle room lock status.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="room-name-edit" className="text-xs text-zinc-300">
                  Room Name
                </Label>
                <Input
                  id="room-name-edit"
                  value={roomNameInput}
                  onChange={(e) => setRoomNameInput(e.target.value)}
                  className="bg-zinc-950 border-zinc-700 text-sm text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="room-desc-edit" className="text-xs text-zinc-300">
                  Room Description
                </Label>
                <Input
                  id="room-desc-edit"
                  value={roomDescInput}
                  onChange={(e) => setRoomDescInput(e.target.value)}
                  className="bg-zinc-950 border-zinc-700 text-sm text-white"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div>
                  <Label htmlFor="room-lock-edit" className="text-xs font-semibold text-zinc-200">
                    Lock Room
                  </Label>
                  <p className="text-[11px] text-zinc-400">
                    When enabled, new participants cannot join this room.
                  </p>
                </div>
                <Switch
                  id="room-lock-edit"
                  checked={roomLockedInput}
                  onCheckedChange={setRoomLockedInput}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRoomSettings}
                className="bg-purple-600 hover:bg-purple-500 text-white"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
