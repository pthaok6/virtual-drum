import {
  LiveRoom,
  RoomMember,
  RoomChatMessage,
  UserProfile,
  DrumType,
  DrumHitBroadcast,
} from '../types';
import { getSupabaseClient } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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
    | 'MEDIA_STATE_CHANGED'
    | 'SYNC_REQUEST'
    | 'SYNC_RESPONSE';
  roomId?: string;
  room?: LiveRoom;
  rooms?: LiveRoom[];
  message?: RoomChatMessage;
  hit?: DrumHitBroadcast;
  kickedUserId?: string;
  senderId?: string;
  targetSenderId?: string;
}

// Initial demo public room (cleared for testing)
const SEED_PUBLIC_ROOMS: LiveRoom[] = [];

class RoomService {
  private localChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private supabaseChannel: RealtimeChannel | null = null;
  private isSupabaseSubscribed = false;
  private pendingBroadcastQueue: BroadcastPayload[] = [];
  private clientSessionId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  private currentTrackedRoom: LiveRoom | null = null;
  private currentTrackedMember: RoomMember | null = null;

  private roomListeners: Set<(rooms: LiveRoom[]) => void> = new Set();
  private singleRoomListeners: Map<
    string,
    Set<(room: LiveRoom | null, messages: RoomChatMessage[]) => void>
  > = new Map();
  private drumHitListeners: Map<string, Set<(hit: DrumHitBroadcast) => void>> = new Map();
  private kickedListeners: Map<string, Set<(kickedUserId: string) => void>> = new Map();
  private signalListeners: Set<(payload: any) => void> = new Set();

  constructor() {
    this.clearOldRoomsData();
    this.initBroadcastChannel();
    this.initStorageListener();
    this.initServerSync();
    this.initSupabaseRealtime();
    this.fetchRoomsFromServer();
  }

  private clearOldRoomsData() {
    try {
      const resetRoomsKey = 'v_drum_clear_all_rooms_v9_clean';
      if (!localStorage.getItem(resetRoomsKey)) {
        localStorage.removeItem(ROOMS_STORAGE_KEY);
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(MESSAGES_STORAGE_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
        localStorage.setItem(resetRoomsKey, 'true');
      }
    } catch {}
  }

  // ================= 1. SERVER SSE SYNC (ZERO DELAY ACROSS BROWSERS) =================

  private initServerSync() {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource('/api/live-rooms/events');

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerEvent(data);
        } catch (e) {
          console.warn('Failed to parse SSE event:', e);
        }
      };

      this.eventSource.onerror = () => {
        // Browser handles auto-reconnect for EventSource
      };
    } catch (err) {
      console.warn('EventSource initialization warning:', err);
    }
  }

  private handleServerEvent(data: any) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'ROOMS_UPDATED': {
        if (Array.isArray(data.rooms)) {
          this.setRoomsFromRemote(data.rooms);
        }
        if (data.room) {
          this.mergeRoom(data.room);
          this.notifyRoomsUpdated(this.getRooms());
        }
        break;
      }

      case 'ROOM_UPDATED': {
        if (data.room) {
          const sanitized = this.sanitizeRoom(data.room);
          if (sanitized) {
            this.mergeRoom(sanitized);
            const messages = this.getMessages(sanitized.id);
            this.notifySingleRoomUpdated(sanitized.id, sanitized, messages);
            this.notifyRoomsUpdated(this.getRooms());
          }
        }
        break;
      }

      case 'WEBRTC_SIGNAL': {
        this.signalListeners.forEach((cb) => {
          try {
            cb(data);
          } catch {}
        });
        break;
      }

      case 'ROOM_ENDED': {
        if (data.roomId) {
          const rooms = this.getRooms().filter((r) => r.id !== data.roomId);
          this.saveRoomsToLocal(rooms);
          this.clearMessages(data.roomId);
          this.notifySingleRoomUpdated(data.roomId, null, []);
          this.notifyRoomsUpdated(rooms);
        }
        break;
      }

      case 'CHAT_MESSAGE': {
        if (data.roomId && data.message) {
          const messages = this.getMessages(data.roomId);
          if (!messages.some((m) => m.id === data.message.id)) {
            const updated = [...messages, data.message].slice(-100);
            this.saveMessagesToLocal(data.roomId, updated);
            const room = this.getRoom(data.roomId);
            this.notifySingleRoomUpdated(data.roomId, room, updated);
          }
        }
        break;
      }

      case 'MEMBER_KICKED': {
        if (data.roomId && data.kickedUserId) {
          const listeners = this.kickedListeners.get(data.roomId);
          if (listeners) {
            listeners.forEach((cb) => cb(data.kickedUserId));
          }
          if (data.room) {
            this.mergeRoom(data.room);
          }
          const room = this.getRoom(data.roomId);
          const messages = this.getMessages(data.roomId);
          this.notifySingleRoomUpdated(data.roomId, room, messages);
          this.notifyRoomsUpdated(this.getRooms());
        }
        break;
      }

      case 'DRUM_HIT': {
        if (data.roomId && data.hit) {
          const listeners = this.drumHitListeners.get(data.roomId);
          if (listeners) {
            listeners.forEach((cb) => cb(data.hit));
          }
        }
        break;
      }

      case 'MEDIA_STATE_CHANGED': {
        if (data.room) {
          const sanitized = this.sanitizeRoom(data.room);
          if (sanitized) {
            this.mergeRoom(sanitized);
            const messages = this.getMessages(sanitized.id);
            this.notifySingleRoomUpdated(sanitized.id, sanitized, messages);
            this.notifyRoomsUpdated(this.getRooms());
          }
        }
        break;
      }
    }
  }

  public async fetchRoomsFromServer(): Promise<LiveRoom[]> {
    try {
      const res = await fetch('/api/live-rooms', { cache: 'no-store' });
      if (res.ok) {
        const remoteRooms = await res.json();
        if (Array.isArray(remoteRooms)) {
          this.setRoomsFromRemote(remoteRooms);
          return this.getRooms();
        }
      }
    } catch {
      // Fallback to local storage if endpoint unavailable
    }
    return this.getRooms();
  }

  public async fetchRoomFromServer(roomId: string): Promise<LiveRoom | null> {
    try {
      const res = await fetch(`/api/live-rooms/${roomId}`, { cache: 'no-store' });
      if (res.ok) {
        const remoteRoom = await res.json();
        const sanitized = this.sanitizeRoom(remoteRoom);
        if (sanitized) {
          this.mergeRoom(sanitized);
          const messages = this.getMessages(roomId);
          this.notifySingleRoomUpdated(roomId, sanitized, messages);
          return sanitized;
        }
      }
    } catch {}
    return this.getRoom(roomId);
  }

  public async fetchMessagesFromServer(roomId: string): Promise<RoomChatMessage[]> {
    try {
      const res = await fetch(`/api/live-rooms/${roomId}/messages`, { cache: 'no-store' });
      if (res.ok) {
        const msgs = await res.json();
        if (Array.isArray(msgs)) {
          this.saveMessagesToLocal(roomId, msgs);
          const room = this.getRoom(roomId);
          this.notifySingleRoomUpdated(roomId, room, msgs);
          return msgs;
        }
      }
    } catch {}
    return this.getMessages(roomId);
  }

  public sanitizeRoom(r: any): LiveRoom | null {
    if (!r || typeof r !== 'object' || !r.id) return null;
    return {
      id: String(r.id),
      name: String(r.name || 'Drum Jam Room'),
      description: String(r.description || 'Live drum jam and voice chat room.'),
      genre: String(r.genre || 'All'),
      ownerId: String(r.ownerId || 'host-system'),
      ownerName: String(r.ownerName || 'Host'),
      ownerAvatar: String(r.ownerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.ownerName || 'Drummer'}`),
      maxMembers: Math.min(16, Math.max(2, Number(r.maxMembers) || 8)),
      isLocked: Boolean(r.isLocked),
      members: Array.isArray(r.members)
        ? r.members.filter(Boolean).map((m: any) => ({
            id: String(m.id || ''),
            username: String(m.username || 'Member'),
            avatarUrl: String(m.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.username || 'Drummer'}`),
            level: Number(m.level) || 1,
            role: m.role === 'owner' ? 'owner' : 'member',
            isMuted: Boolean(m.isMuted),
            isCameraOn: Boolean(m.isCameraOn),
            isScreenSharing: Boolean(m.isScreenSharing),
            isSpeaking: Boolean(m.isSpeaking),
            audioLevel: Number(m.audioLevel) || 0,
            joinedAt: Number(m.joinedAt) || Date.now(),
          }))
        : [],
      activeScreenShareUser: r.activeScreenShareUser ? String(r.activeScreenShareUser) : null,
      createdAt: Number(r.createdAt) || Date.now(),
      updatedAt: Number(r.updatedAt) || Date.now(),
    };
  }

  private setRoomsFromRemote(incomingRooms: LiveRoom[]) {
    if (!Array.isArray(incomingRooms)) return;

    // Remote rooms from server are authoritative across browsers
    const sanitizedList = incomingRooms
      .map((r) => this.sanitizeRoom(r))
      .filter((r): r is LiveRoom => r !== null);

    this.saveRoomsToLocal(sanitizedList);
    this.notifyRoomsUpdated(sanitizedList);

    // Also notify any single active room listeners with updated member data
    const map = new Map(sanitizedList.map((r) => [r.id, r]));
    this.singleRoomListeners.forEach((listeners, roomId) => {
      const current = map.get(roomId) || null;
      const msgs = this.getMessages(roomId);
      listeners.forEach((cb) => {
        try {
          cb(current, msgs);
        } catch {}
      });
    });
  }

  // ================= 2. LOCAL BROADCAST & STORAGE LISTENER =================

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.localChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.localChannel.onmessage = (event) => {
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

  // ================= 3. SUPABASE REALTIME (CLOUD BACKBONE) =================

  private initSupabaseRealtime() {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      this.supabaseChannel = supabase.channel('drum_rooms_global', {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: this.clientSessionId },
        },
      });

      this.supabaseChannel
        .on('broadcast', { event: 'room_event' }, ({ payload }) => {
          if (payload) {
            this.handleBroadcastMessage(payload);
          }
        })
        .on('presence', { event: 'sync' }, () => {
          this.handlePresenceSync();
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          this.handlePresenceJoin(newPresences as Array<{ room?: LiveRoom }>);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          this.handlePresenceLeave(leftPresences as Array<{ room?: LiveRoom }>);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            this.isSupabaseSubscribed = true;

            // Flush pending broadcasts
            while (this.pendingBroadcastQueue.length > 0) {
              const pending = this.pendingBroadcastQueue.shift();
              if (pending) this.sendToSupabase(pending);
            }

            // Sync current active room or presence key
            this.syncPresence(this.currentTrackedRoom, this.currentTrackedMember);

            // Request sync from existing peers
            this.requestSync();

            // Read existing presence state
            this.handlePresenceSync();
          } else {
            this.isSupabaseSubscribed = false;
          }
        });
    } catch (err) {
      console.warn('Supabase realtime error:', err);
    }
  }

  private handlePresenceSync() {
    // Realtime presence tracks peer connectivity & speaking indicators;
    // Room list lifecycle is authoritatively managed by server relay and SSE
  }

  private handlePresenceJoin(_newPresences: Array<{ room?: LiveRoom }>) {
    // Realtime presence tracks peer connectivity & speaking indicators;
    // Room list lifecycle is authoritatively managed by server relay and SSE
  }

  private handlePresenceLeave(_leftPresences: Array<{ room?: LiveRoom }>) {
    // Optional cleanup on peer disconnection
  }

  public syncPresence(room: LiveRoom | null, member?: RoomMember | null) {
    this.currentTrackedRoom = room;
    this.currentTrackedMember = member || null;

    if (!this.supabaseChannel || !this.isSupabaseSubscribed) return;

    try {
      this.supabaseChannel
        .track({
          sessionId: this.clientSessionId,
          activeRoomId: room ? room.id : null,
          room: room,
          member: member || null,
          timestamp: Date.now(),
        })
        .catch(() => {});
    } catch {}
  }

  private sendToSupabase(payload: BroadcastPayload) {
    if (this.supabaseChannel && this.isSupabaseSubscribed) {
      this.supabaseChannel
        .send({
          type: 'broadcast',
          event: 'room_event',
          payload,
        })
        .catch(() => {});
    } else {
      this.pendingBroadcastQueue.push(payload);
    }
  }

  private broadcast(payload: BroadcastPayload) {
    // 1. Same-browser cross-tab broadcast
    if (this.localChannel) {
      try {
        this.localChannel.postMessage(payload);
      } catch (err) {
        console.warn('Failed to post local broadcast:', err);
      }
    }

    // 2. Cross-browser / remote peer broadcast via Supabase
    this.sendToSupabase(payload);
  }

  public requestSync() {
    this.fetchRoomsFromServer();
    this.broadcast({
      type: 'SYNC_REQUEST',
      senderId: this.clientSessionId,
    });
    this.handlePresenceSync();
  }

  public mergeRoom(incoming: LiveRoom): boolean {
    const sanitized = this.sanitizeRoom(incoming);
    if (!sanitized) return false;
    const rooms = this.getRooms();
    const idx = rooms.findIndex((r) => r.id === sanitized.id);

    if (idx === -1) {
      const updated = [sanitized, ...rooms];
      this.saveRoomsToLocal(updated);
      return true;
    } else {
      rooms[idx] = sanitized;
      this.saveRoomsToLocal(rooms);
      return true;
    }
  }

  private handleBroadcastMessage(payload: BroadcastPayload) {
    if (!payload || !payload.type) return;

    switch (payload.type) {
      case 'SYNC_REQUEST': {
        this.fetchRoomsFromServer();
        break;
      }

      case 'SYNC_RESPONSE': {
        if (!payload.targetSenderId || payload.targetSenderId === this.clientSessionId) {
          if (Array.isArray(payload.rooms)) {
            this.setRoomsFromRemote(payload.rooms);
          }
        }
        break;
      }

      case 'ROOMS_UPDATED': {
        if (Array.isArray(payload.rooms)) {
          this.setRoomsFromRemote(payload.rooms);
        } else if (payload.room) {
          this.mergeRoom(payload.room);
          this.notifyRoomsUpdated(this.getRooms());
        }
        break;
      }

      case 'ROOM_UPDATED': {
        if (payload.room) {
          this.mergeRoom(payload.room);
          const messages = this.getMessages(payload.room.id);
          this.notifySingleRoomUpdated(payload.room.id, payload.room, messages);
          this.notifyRoomsUpdated(this.getRooms());
        }
        break;
      }

      case 'ROOM_ENDED': {
        if (payload.roomId) {
          const rooms = this.getRooms().filter((r) => r.id !== payload.roomId);
          this.saveRoomsToLocal(rooms);
          this.clearMessages(payload.roomId);
          this.notifySingleRoomUpdated(payload.roomId, null, []);
          this.notifyRoomsUpdated(rooms);
        }
        break;
      }

      case 'CHAT_MESSAGE': {
        if (payload.roomId && payload.message) {
          const messages = this.getMessages(payload.roomId);
          if (!messages.some((m) => m.id === payload.message!.id)) {
            const updated = [...messages, payload.message].slice(-100);
            this.saveMessagesToLocal(payload.roomId, updated);
            const room = this.getRoom(payload.roomId);
            this.notifySingleRoomUpdated(payload.roomId, room, updated);
          }
        }
        break;
      }

      case 'MEDIA_STATE_CHANGED': {
        if (payload.room) {
          this.mergeRoom(payload.room);
          const messages = this.getMessages(payload.room.id);
          this.notifySingleRoomUpdated(payload.room.id, payload.room, messages);
          this.notifyRoomsUpdated(this.getRooms());
        }
        break;
      }

      case 'MEMBER_KICKED': {
        if (payload.roomId && payload.kickedUserId) {
          const listeners = this.kickedListeners.get(payload.roomId);
          if (listeners) {
            listeners.forEach((cb) => cb(payload.kickedUserId!));
          }
          if (payload.room) {
            this.mergeRoom(payload.room);
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
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [];
      }
      const sanitized = parsed
        .map((item) => this.sanitizeRoom(item))
        .filter((r): r is LiveRoom => r !== null);
      return sanitized;
    } catch {
      return [];
    }
  }

  public async clearAllRooms(): Promise<void> {
    try {
      await fetch('/api/live-rooms', { method: 'DELETE' });
    } catch {}
    this.saveRoomsToLocal([]);
    this.notifyRoomsUpdated([]);
    this.broadcast({ type: 'ROOMS_UPDATED', rooms: [] });
    this.syncPresence(null, null);
    this.singleRoomListeners.forEach((listeners, roomId) => {
      this.clearMessages(roomId);
      listeners.forEach((cb) => {
        try {
          cb(null, []);
        } catch {}
      });
    });
  }

  public async deleteRoom(roomId: string): Promise<void> {
    try {
      await fetch(`/api/live-rooms/${roomId}`, { method: 'DELETE' });
    } catch {}
    const remaining = this.getRooms().filter((r) => r.id !== roomId);
    this.saveRoomsToLocal(remaining);
    this.clearMessages(roomId);
    this.broadcast({ type: 'ROOM_ENDED', roomId });
    this.notifyRoomsUpdated(remaining);
    this.notifySingleRoomUpdated(roomId, null, []);
  }

  public getRoom(roomId: string): LiveRoom | null {
    if (!roomId) return null;
    const rooms = this.getRooms();
    const found = rooms.find((r) => r.id === roomId);
    return found ? (this.sanitizeRoom(found) || found) : null;
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
      description: description.trim() || 'Live drum jam and voice chat room.',
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
      `🎉 Host ${owner.username} created room "${newRoom.name}". Welcome!`,
      'system'
    );

    // 1. Post to local server relay (instant zero-delay sync across browsers)
    fetch('/api/live-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: newRoom }),
    }).catch(() => {});

    // 2. Sync presence & broadcast to other peers
    this.syncPresence(newRoom, ownerMember);
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
      return { success: false, error: 'Room does not exist or has ended.' };
    }
    if (targetRoom.isLocked) {
      return { success: false, error: 'This room is currently locked by the host.' };
    }
    if (targetRoom.members.length >= targetRoom.maxMembers) {
      const existing = targetRoom.members.find((m) => m.id === user.id);
      if (!existing) {
        return { success: false, error: 'Room has reached maximum capacity.' };
      }
    }

    const alreadyJoined = targetRoom.members.some((m) => m.id === user.id);
    let memberObj = targetRoom.members.find((m) => m.id === user.id);

    if (!alreadyJoined) {
      memberObj = {
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
      targetRoom.members.push(memberObj);
      targetRoom.updatedAt = Date.now();
      this.saveRoomsToLocal(rooms);

      this.sendMessage(roomId, user, `👋 ${user.username} joined the room.`, 'system');

      // Post join to server relay
      fetch(`/api/live-rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member: memberObj }),
      }).catch(() => {});

      this.syncPresence(targetRoom, memberObj);
      this.broadcast({ type: 'ROOM_UPDATED', roomId, room: targetRoom });
      this.notifyRoomsUpdated(rooms);
    } else {
      this.syncPresence(targetRoom, memberObj);
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
    const memberName = departingMember?.username || 'Member';

    // Remove member
    room.members = room.members.filter((m) => m.id !== userId);

    // If screen share was from this user, reset
    if (room.activeScreenShareUser === userId) {
      room.activeScreenShareUser = null;
    }

    // Stop presence tracking for this room
    this.syncPresence(null, null);

    // Post leave to server relay
    fetch(`/api/live-rooms/${roomId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {});

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
        `👑 Host left. ${newOwner.username} is now the new room Host!`,
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
        `🚪 ${memberName} left the room.`,
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

    this.syncPresence(null, null);

    // Post delete to server relay
    fetch(`/api/live-rooms/${roomId}`, {
      method: 'DELETE',
    }).catch(() => {});

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
    const targetName = target?.username || 'Member';

    room.members = room.members.filter((m) => m.id !== targetUserId);
    if (room.activeScreenShareUser === targetUserId) {
      room.activeScreenShareUser = null;
    }
    room.updatedAt = Date.now();
    this.saveRoomsToLocal(rooms);

    // Post kick to server relay
    fetch(`/api/live-rooms/${roomId}/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, targetUserId }),
    }).catch(() => {});

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
      `⛔ Host removed ${targetName} from the room.`,
      'system'
    );

    this.broadcast({ type: 'MEMBER_KICKED', roomId, kickedUserId: targetUserId, room });
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

    if (room.ownerId !== requestedByUserId && targetUserId !== requestedByUserId) {
      return false;
    }

    const member = room.members.find((m) => m.id === targetUserId);
    if (!member) return false;

    member.isMuted = mute;
    room.updatedAt = Date.now();
    this.saveRoomsToLocal(rooms);

    // Post media state to server relay
    fetch(`/api/live-rooms/${roomId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: targetUserId,
        mediaState: { isMuted: mute },
      }),
    }).catch(() => {});

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
        `🔇 Host ${mute ? 'muted' : 'unmuted'} ${member.username}'s microphone.`,
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
          `🖥️ ${member.username} is sharing their screen.`,
          'system'
        );
      } else if (room.activeScreenShareUser === userId) {
        room.activeScreenShareUser = null;
      }
    }

    room.updatedAt = Date.now();
    this.saveRoomsToLocal(rooms);

    // Post to server relay
    fetch(`/api/live-rooms/${roomId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, mediaState: partial }),
    }).catch(() => {});

    this.syncPresence(room, member);
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

    // Post to server relay
    fetch(`/api/live-rooms/${roomId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, ...options }),
    }).catch(() => {});

    this.syncPresence(room, null);
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
    sender: { id: string; username: string; avatarUrl: string; [key: string]: any },
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

    const updated = [...messages, newMsg].slice(-100);
    this.saveMessagesToLocal(roomId, updated);

    // Post message to server relay
    fetch(`/api/live-rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMsg }),
    }).catch(() => {});

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
    sender: string | { id: string; username: string },
    drumOrName: string | DrumType,
    velocityOrDrum?: DrumType | number,
    optVelocity?: number
  ) {
    let senderId: string;
    let senderName: string;
    let drum: DrumType;
    let velocity: number;

    if (typeof sender === 'object' && sender !== null) {
      senderId = sender.id;
      senderName = sender.username;
      drum = drumOrName as DrumType;
      velocity = typeof velocityOrDrum === 'number' ? velocityOrDrum : 0.85;
    } else {
      senderId = String(sender);
      senderName = String(drumOrName);
      drum = velocityOrDrum as DrumType;
      velocity = typeof optVelocity === 'number' ? optVelocity : 0.85;
    }

    const hit: DrumHitBroadcast = {
      roomId,
      senderId,
      senderName,
      drum,
      velocity,
      timestamp: Date.now(),
    };

    // Post drum hit to server relay
    fetch(`/api/live-rooms/${roomId}/drum-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hit }),
    }).catch(() => {});

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

  // ================= WEBRTC SIGNALING =================

  public onWebRTCSignal(callback: (payload: any) => void): () => void {
    this.signalListeners.add(callback);
    return () => {
      this.signalListeners.delete(callback);
    };
  }

  // ================= SUBSCRIPTIONS =================

  public subscribeRooms(callback: (rooms: LiveRoom[]) => void): () => void {
    this.roomListeners.add(callback);
    callback(this.getRooms());

    // Immediately trigger server fetch and presence sync
    this.fetchRoomsFromServer();
    this.requestSync();

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

    this.fetchMessagesFromServer(roomId);
    this.requestSync();

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
