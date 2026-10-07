import {
  LiveRoom,
  RoomMember,
  RoomChatMessage,
  UserProfile,
  DrumType,
  DrumHitBroadcast,
} from '../types';
import { getSupabaseClient } from './supabase';

const ROOMS_STORAGE_KEY = 'virtual_drum_active_rooms';
const MESSAGES_STORAGE_PREFIX = 'virtual_drum_room_messages_';
const BROADCAST_CHANNEL_NAME = 'virtual_drum_live_rooms_broadcast';

interface BroadcastPayload {
  type:
    | 'ROOMS_UPDATED'
    | 'ROOM_UPDATED'
    | 'ROOM_ENDED'
    | 'MEMBER_KICKED'
    | 'CHAT_MESSAGE'
    | 'DRUM_HIT'
    | 'MEDIA_STATE_CHANGED';
  roomId?: string;
  room?: LiveRoom;
  message?: RoomChatMessage;
  hit?: DrumHitBroadcast;
  kickedUserId?: string;
  senderId?: string;
}

// Initial demo public room so lobby is alive immediately
const SEED_PUBLIC_ROOMS: LiveRoom[] = [
  {
    id: 'room-acoustic-lounge',
    name: 'Acoustic Groove Lounge 🥁',
    description: 'Phòng giao lưu nhạc mộc, chia sẻ nhịp beat và trò chuyện tự do.',
    genre: 'Acoustic',
    ownerId: 'host-system',
    ownerName: 'Groove Master (Bot Host)',
    ownerAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=GrooveMaster',
    maxMembers: 8,
    isLocked: false,
    members: [
      {
        id: 'host-system',
        username: 'Groove Master (Bot Host)',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=GrooveMaster',
        level: 10,
        role: 'owner',
        isMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        joinedAt: Date.now() - 3600000,
      },
    ],
    activeScreenShareUser: null,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  },
];

class RoomService {
  private channel: BroadcastChannel | null = null;
  private roomListeners: Set<(rooms: LiveRoom[]) => void> = new Set();
  private singleRoomListeners: Map<
    string,
    Set<(room: LiveRoom | null, messages: RoomChatMessage[]) => void>
  > = new Map();
  private drumHitListeners: Map<string, Set<(hit: DrumHitBroadcast) => void>> = new Map();
  private kickedListeners: Map<string, Set<(kickedUserId: string) => void>> = new Map();

  constructor() {
    this.initBroadcastChannel();
    this.initStorageListener();
    this.initSupabaseRealtime();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported:', err);
      }
    }
  }

  private initStorageListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === ROOMS_STORAGE_KEY) {
          const rooms = this.getRooms();
          this.notifyRoomsUpdated(rooms);
        } else if (e.key && e.key.startsWith(MESSAGES_STORAGE_PREFIX)) {
          const roomId = e.key.replace(MESSAGES_STORAGE_PREFIX, '');
          const room = this.getRoom(roomId);
          const messages = this.getMessages(roomId);
          this.notifySingleRoomUpdated(roomId, room, messages);
        }
      });
    }
  }

  private initSupabaseRealtime() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const channel = supabase.channel('drum_rooms_global');
      channel
        .on('broadcast', { event: 'room_event' }, ({ payload }) => {
          if (payload) {
            this.handleBroadcastMessage(payload);
          }
        })
        .subscribe();
    } catch {
      // Supabase realtime is optional
    }
  }

  private broadcast(payload: BroadcastPayload) {
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (err) {
        console.warn('Failed to post broadcast message:', err);
      }
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const channel = supabase.channel('drum_rooms_global');
        channel.send({
          type: 'broadcast',
          event: 'room_event',
          payload,
        });
      } catch {
        // Ignore
      }
    }
  }

  private handleBroadcastMessage(payload: BroadcastPayload) {
    if (!payload || !payload.type) return;

    switch (payload.type) {
      case 'ROOMS_UPDATED': {
        const rooms = this.getRooms();
        this.notifyRoomsUpdated(rooms);
        break;
      }
      case 'ROOM_UPDATED':
      case 'MEDIA_STATE_CHANGED': {
        if (payload.roomId) {
          const room = this.getRoom(payload.roomId);
          const messages = this.getMessages(payload.roomId);
          this.notifySingleRoomUpdated(payload.roomId, room, messages);
          this.notifyRoomsUpdated(this.getRooms());
        }
        break;
      }
      case 'ROOM_ENDED': {
        if (payload.roomId) {
          this.notifySingleRoomUpdated(payload.roomId, null, []);
          this.notifyRoomsUpdated(this.getRooms());
        }
        break;
      }
      case 'CHAT_MESSAGE': {
        if (payload.roomId) {
          const room = this.getRoom(payload.roomId);
          const messages = this.getMessages(payload.roomId);
          this.notifySingleRoomUpdated(payload.roomId, room, messages);
        }
        break;
      }
      case 'MEMBER_KICKED': {
        if (payload.roomId && payload.kickedUserId) {
          const listeners = this.kickedListeners.get(payload.roomId);
          if (listeners) {
            listeners.forEach((cb) => cb(payload.kickedUserId!));
          }
          const room = this.getRoom(payload.roomId);
          const messages = this.getMessages(payload.roomId);
          this.notifySingleRoomUpdated(payload.roomId, room, messages);
          this.notifyRoomsUpdated(this.getRooms());
        }
        break;
      }
      case 'DRUM_HIT': {
        if (payload.roomId && payload.hit) {
          const listeners = this.drumHitListeners.get(payload.roomId);
          if (listeners) {
            listeners.forEach((cb) => cb(payload.hit!));
          }
        }
        break;
      }
    }
  }

  // ================= ROOM CRUD =================

  public getRooms(): LiveRoom[] {
    try {
      const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
      if (!raw) {
        this.saveRoomsToLocal(SEED_PUBLIC_ROOMS);
        return SEED_PUBLIC_ROOMS;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        this.saveRoomsToLocal(SEED_PUBLIC_ROOMS);
        return SEED_PUBLIC_ROOMS;
      }
      return parsed;
    } catch {
      return SEED_PUBLIC_ROOMS;
    }
  }

  public getRoom(roomId: string): LiveRoom | null {
    const rooms = this.getRooms();
    return rooms.find((r) => r.id === roomId) || null;
  }

  public createRoom(
    owner: UserProfile,
    name: string,
    genre: string = 'All',
    maxMembers: number = 8,
    description: string = ''
  ): LiveRoom {
    const rooms = this.getRooms();
    const newRoomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const ownerMember: RoomMember = {
      id: owner.id,
      username: owner.username,
      avatarUrl: owner.avatarUrl,
      level: owner.level,
      role: 'owner',
      isMuted: false,
      isCameraOn: false,
      isScreenSharing: false,
      joinedAt: Date.now(),
    };

    const newRoom: LiveRoom = {
      id: newRoomId,
      name: name.trim() || `${owner.username}'s Jam Room`,
      description: description.trim() || 'Phòng biểu diễn trống và trò chuyện trực tuyến.',
      genre: genre || 'All',
      ownerId: owner.id,
      ownerName: owner.username,
      ownerAvatar: owner.avatarUrl,
      maxMembers: Math.min(16, Math.max(2, maxMembers)),
      isLocked: false,
      members: [ownerMember],
      activeScreenShareUser: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [newRoom, ...rooms];
    this.saveRoomsToLocal(updated);

    // Initial system chat message
    this.sendMessage(
      newRoomId,
      owner,
      `🎉 Chủ phòng ${owner.username} đã tạo phòng "${newRoom.name}". Chào mừng các thành viên!`,
      'system'
    );

    this.broadcast({ type: 'ROOMS_UPDATED', roomId: newRoomId, room: newRoom });
    this.notifyRoomsUpdated(updated);
    return newRoom;
  }

  public joinRoom(
    roomId: string,
    user: UserProfile
  ): { success: boolean; room?: LiveRoom; error?: string } {
    const rooms = this.getRooms();
    const targetRoom = rooms.find((r) => r.id === roomId);

    if (!targetRoom) {
      return { success: false, error: 'Phòng không tồn tại hoặc đã bị giải tán.' };
    }
    if (targetRoom.isLocked) {
      return { success: false, error: 'Phòng hiện đang bị khóa bởi chủ sở hữu.' };
    }
    if (targetRoom.members.length >= targetRoom.maxMembers) {
      // Check if user is already in members
      const existing = targetRoom.members.find((m) => m.id === user.id);
      if (!existing) {
        return { success: false, error: 'Phòng đã đủ số lượng thành viên tối đa.' };
      }
    }

    const alreadyJoined = targetRoom.members.some((m) => m.id === user.id);
    if (!alreadyJoined) {
      const newMember: RoomMember = {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        level: user.level,
        role: 'member',
        isMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        joinedAt: Date.now(),
      };
      targetRoom.members.push(newMember);
      targetRoom.updatedAt = Date.now();
      this.saveRoomsToLocal(rooms);

      this.sendMessage(roomId, user, `👋 ${user.username} đã tham gia phòng.`, 'system');
      this.broadcast({ type: 'ROOM_UPDATED', roomId, room: targetRoom });
      this.notifyRoomsUpdated(rooms);
    }

    const messages = this.getMessages(roomId);
    this.notifySingleRoomUpdated(roomId, targetRoom, messages);
    return { success: true, room: targetRoom };
  }

  public leaveRoom(roomId: string, userId: string): void {
    const rooms = this.getRooms();
    const roomIdx = rooms.findIndex((r) => r.id === roomId);
    if (roomIdx === -1) return;

    const room = rooms[roomIdx];
    const departingMember = room.members.find((m) => m.id === userId);
    const memberName = departingMember?.username || 'Thành viên';

    // Remove member
    room.members = room.members.filter((m) => m.id !== userId);

    // If screen share was from this user, reset
    if (room.activeScreenShareUser === userId) {
      room.activeScreenShareUser = null;
    }

    // If no members left and not seed room, clean up room
    if (room.members.length === 0 && !room.id.startsWith('room-acoustic-lounge')) {
      const remaining = rooms.filter((r) => r.id !== roomId);
      this.saveRoomsToLocal(remaining);
      this.clearMessages(roomId);
      this.broadcast({ type: 'ROOM_ENDED', roomId });
      this.notifyRoomsUpdated(remaining);
      this.notifySingleRoomUpdated(roomId, null, []);
      return;
    }

    // If owner left, promote next member to owner
    if (room.ownerId === userId && room.members.length > 0) {
      const newOwner = room.members[0];
      newOwner.role = 'owner';
      room.ownerId = newOwner.id;
      room.ownerName = newOwner.username;
      room.ownerAvatar = newOwner.avatarUrl;
      this.sendMessage(
        roomId,
        {
          id: newOwner.id,
          username: newOwner.username,
          avatarUrl: newOwner.avatarUrl,
          level: newOwner.level,
          email: '',
          totalScore: 0,
          createdAt: 0,
        },
        `👑 Chủ phòng cũ đã rời đi. ${newOwner.username} hiện là Chủ sở hữu mới của phòng!`,
        'system'
      );
    } else {
      this.sendMessage(
        roomId,
        {
          id: userId,
          username: memberName,
          avatarUrl: departingMember?.avatarUrl || '',
          level: departingMember?.level || 1,
          email: '',
          totalScore: 0,
          createdAt: 0,
        },
        `🚪 ${memberName} đã rời khỏi phòng.`,
        'system'
      );
    }

    room.updatedAt = Date.now();
    this.saveRoomsToLocal(rooms);
    this.broadcast({ type: 'ROOM_UPDATED', roomId, room });
    this.notifyRoomsUpdated(rooms);

    const messages = this.getMessages(roomId);
    this.notifySingleRoomUpdated(roomId, room, messages);
  }

  public endRoom(roomId: string, ownerId: string): boolean {
    const rooms = this.getRooms();
    const target = rooms.find((r) => r.id === roomId);
    if (!target || target.ownerId !== ownerId) return false;

    const remaining = rooms.filter((r) => r.id !== roomId);
    this.saveRoomsToLocal(remaining);
    this.clearMessages(roomId);

    this.broadcast({ type: 'ROOM_ENDED', roomId });
    this.notifyRoomsUpdated(remaining);
    this.notifySingleRoomUpdated(roomId, null, []);
    return true;
  }

  public kickMember(roomId: string, ownerId: string, targetUserId: string): boolean {
    const rooms = this.getRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room || room.ownerId !== ownerId || targetUserId === ownerId) return false;

    const target = room.members.find((m) => m.id === targetUserId);
    const targetName = target?.username || 'Thành viên';

    room.members = room.members.filter((m) => m.id !== targetUserId);
    if (room.activeScreenShareUser === targetUserId) {
      room.activeScreenShareUser = null;
    }
    room.updatedAt = Date.now();
    this.saveRoomsToLocal(rooms);

    this.sendMessage(
      roomId,
      {
        id: ownerId,
        username: room.ownerName,
        avatarUrl: room.ownerAvatar,
        level: 1,
        email: '',
        totalScore: 0,
        createdAt: 0,
      },
      `⛔ Chủ phòng đã mời ${targetName} ra khỏi phòng.`,
      'system'
    );

    this.broadcast({ type: 'MEMBER_KICKED', roomId, kickedUserId: targetUserId });
    this.notifyRoomsUpdated(rooms);
    this.notifySingleRoomUpdated(roomId, room, this.getMessages(roomId));
    return true;
  }

  public toggleMuteMember(
    roomId: string,
    requestedByUserId: string,
    targetUserId: string,
    mute: boolean
  ): boolean {
    const rooms = this.getRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return false;

    // Allowed if requested by owner or target muting self
    if (room.ownerId !== requestedByUserId && targetUserId !== requestedByUserId) {
      return false;
    }

    const member = room.members.find((m) => m.id === targetUserId);
    if (!member) return false;

    member.isMuted = mute;
    room.updatedAt = Date.now();
    this.saveRoomsToLocal(rooms);

    if (requestedByUserId === room.ownerId && targetUserId !== requestedByUserId) {
      this.sendMessage(
        roomId,
        {
          id: room.ownerId,
          username: room.ownerName,
          avatarUrl: room.ownerAvatar,
          level: 1,
          email: '',
          totalScore: 0,
          createdAt: 0,
        },
        `🔇 Chủ phòng đã ${mute ? 'tắt' : 'bật'} mic của ${member.username}.`,
        'system'
      );
    }

    this.broadcast({ type: 'MEDIA_STATE_CHANGED', roomId, room });
    this.notifySingleRoomUpdated(roomId, room, this.getMessages(roomId));
    return true;
  }

  public updateMediaState(
    roomId: string,
    userId: string,
    partial: {
      isMuted?: boolean;
      isCameraOn?: boolean;
      isScreenSharing?: boolean;
      isSpeaking?: boolean;
      audioLevel?: number;
    }
  ): void {
    const rooms = this.getRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const member = room.members.find((m) => m.id === userId);
    if (!member) return;

    if (partial.isMuted !== undefined) member.isMuted = partial.isMuted;
    if (partial.isCameraOn !== undefined) member.isCameraOn = partial.isCameraOn;
    if (partial.isSpeaking !== undefined) member.isSpeaking = partial.isSpeaking;
    if (partial.audioLevel !== undefined) member.audioLevel = partial.audioLevel;

    if (partial.isScreenSharing !== undefined) {
      member.isScreenSharing = partial.isScreenSharing;
      if (partial.isScreenSharing) {
        room.activeScreenShareUser = userId;
        this.sendMessage(
          roomId,
          {
            id: userId,
            username: member.username,
            avatarUrl: member.avatarUrl,
            level: member.level,
            email: '',
            totalScore: 0,
            createdAt: 0,
          },
          `🖥️ ${member.username} đang chia sẻ màn hình.`,
          'system'
        );
      } else if (room.activeScreenShareUser === userId) {
        room.activeScreenShareUser = null;
      }
    }

    room.updatedAt = Date.now();
    this.saveRoomsToLocal(rooms);
    this.broadcast({ type: 'MEDIA_STATE_CHANGED', roomId, room });
    this.notifySingleRoomUpdated(roomId, room, this.getMessages(roomId));
  }

  public updateRoomSettings(
    roomId: string,
    ownerId: string,
    options: { name?: string; description?: string; isLocked?: boolean }
  ): boolean {
    const rooms = this.getRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room || room.ownerId !== ownerId) return false;

    if (options.name) room.name = options.name.trim();
    if (options.description !== undefined) room.description = options.description.trim();
    if (options.isLocked !== undefined) room.isLocked = options.isLocked;

    room.updatedAt = Date.now();
    this.saveRoomsToLocal(rooms);
    this.broadcast({ type: 'ROOM_UPDATED', roomId, room });
    this.notifyRoomsUpdated(rooms);
    this.notifySingleRoomUpdated(roomId, room, this.getMessages(roomId));
    return true;
  }

  // ================= CHAT MESSAGES =================

  public getMessages(roomId: string): RoomChatMessage[] {
    try {
      const raw = localStorage.getItem(`${MESSAGES_STORAGE_PREFIX}${roomId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public sendMessage(
    roomId: string,
    sender: { id: string; username: string; avatarUrl: string },
    content: string,
    type: 'chat' | 'system' | 'reaction' = 'chat'
  ): RoomChatMessage {
    const messages = this.getMessages(roomId);
    const newMsg: RoomChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomId,
      senderId: sender.id,
      senderName: sender.username,
      senderAvatar: sender.avatarUrl,
      content: content.trim(),
      type,
      timestamp: Date.now(),
    };

    // Keep up to 100 recent messages per room
    const updated = [...messages, newMsg].slice(-100);
    this.saveMessagesToLocal(roomId, updated);

    this.broadcast({ type: 'CHAT_MESSAGE', roomId, message: newMsg });
    const room = this.getRoom(roomId);
    this.notifySingleRoomUpdated(roomId, room, updated);
    return newMsg;
  }

  private clearMessages(roomId: string) {
    try {
      localStorage.removeItem(`${MESSAGES_STORAGE_PREFIX}${roomId}`);
    } catch {}
  }

  // ================= DRUM BROADCAST =================

  public broadcastDrumHit(
    roomId: string,
    senderId: string,
    senderName: string,
    drum: DrumType,
    velocity: number = 0.9
  ) {
    const hit: DrumHitBroadcast = {
      roomId,
      senderId,
      senderName,
      drum,
      velocity,
      timestamp: Date.now(),
    };
    this.broadcast({ type: 'DRUM_HIT', roomId, hit });
  }

  public onDrumHit(roomId: string, callback: (hit: DrumHitBroadcast) => void): () => void {
    if (!this.drumHitListeners.has(roomId)) {
      this.drumHitListeners.set(roomId, new Set());
    }
    this.drumHitListeners.get(roomId)!.add(callback);
    return () => {
      this.drumHitListeners.get(roomId)?.delete(callback);
    };
  }

  // ================= SUBSCRIPTIONS =================

  public subscribeRooms(callback: (rooms: LiveRoom[]) => void): () => void {
    this.roomListeners.add(callback);
    callback(this.getRooms());
    return () => {
      this.roomListeners.delete(callback);
    };
  }

  public subscribeRoom(
    roomId: string,
    callback: (room: LiveRoom | null, messages: RoomChatMessage[]) => void
  ): () => void {
    if (!this.singleRoomListeners.has(roomId)) {
      this.singleRoomListeners.set(roomId, new Set());
    }
    this.singleRoomListeners.get(roomId)!.add(callback);
    callback(this.getRoom(roomId), this.getMessages(roomId));

    return () => {
      this.singleRoomListeners.get(roomId)?.delete(callback);
    };
  }

  public onKicked(roomId: string, callback: (kickedUserId: string) => void): () => void {
    if (!this.kickedListeners.has(roomId)) {
      this.kickedListeners.set(roomId, new Set());
    }
    this.kickedListeners.get(roomId)!.add(callback);
    return () => {
      this.kickedListeners.get(roomId)?.delete(callback);
    };
  }

  private notifyRoomsUpdated(rooms: LiveRoom[]) {
    this.roomListeners.forEach((cb) => {
      try {
        cb(rooms);
      } catch (err) {
        console.warn('Room listener error:', err);
      }
    });
  }

  private notifySingleRoomUpdated(
    roomId: string,
    room: LiveRoom | null,
    messages: RoomChatMessage[]
  ) {
    const listeners = this.singleRoomListeners.get(roomId);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(room, messages);
        } catch (err) {
          console.warn('Single room listener error:', err);
        }
      });
    }
  }

  private saveRoomsToLocal(rooms: LiveRoom[]) {
    try {
      localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
    } catch (e) {
      console.warn('Failed to save rooms to localStorage:', e);
    }
  }

  private saveMessagesToLocal(roomId: string, messages: RoomChatMessage[]) {
    try {
      localStorage.setItem(`${MESSAGES_STORAGE_PREFIX}${roomId}`, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save messages to localStorage:', e);
    }
  }
}

export const roomService = new RoomService();
