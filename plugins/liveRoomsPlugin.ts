import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

interface RoomMember {
  id: string;
  username: string;
  avatarUrl: string;
  level: number;
  role: 'owner' | 'member';
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  joinedAt: number;
}

interface LiveRoom {
  id: string;
  name: string;
  description: string;
  genre: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  maxMembers: number;
  isLocked: boolean;
  members: RoomMember[];
  activeScreenShareUser: string | null;
  createdAt: number;
  updatedAt: number;
}

interface RoomChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: number;
  type: 'chat' | 'system' | 'reaction';
}

const SEED_ROOM: LiveRoom = {
  id: 'room-acoustic-lounge',
  name: 'Acoustic Groove Lounge 🥁',
  description: 'Acoustic jam lounge to share beats, talk, and perform freely.',
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
};

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

export function liveRoomsPlugin(): Plugin {
  const rooms: LiveRoom[] = [SEED_ROOM];
  const roomMessages: Map<string, RoomChatMessage[]> = new Map();
  const sseClients: Set<ServerResponse> = new Set();

  // Initial welcome message for seed room
  roomMessages.set(SEED_ROOM.id, [
    {
      id: 'msg-seed-1',
      roomId: SEED_ROOM.id,
      senderId: 'host-system',
      senderName: 'Groove Master (Bot Host)',
      senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=GrooveMaster',
      content: 'Welcome to the Acoustic Groove Lounge! Turn on your mic and hit the drums.',
      timestamp: Date.now() - 3600000,
      type: 'system',
    },
  ]);

  function broadcastEvent(event: { type: string; [key: string]: any }) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
        if (typeof (client as any).flush === 'function') {
          (client as any).flush();
        }
      } catch {
        sseClients.delete(client);
      }
    }
  }

  return {
    name: 'live-rooms-sync-server',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Only handle /api/live-rooms paths
        if (!url.startsWith('/api/live-rooms')) {
          return next();
        }

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          return res.end();
        }

        // 1. SSE Real-time events stream: /api/live-rooms/events
        if (url === '/api/live-rooms/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
          });
          if (typeof (res as any).flushHeaders === 'function') {
            (res as any).flushHeaders();
          }

          // Immediately send existing rooms state to newly connected client
          res.write(`data: ${JSON.stringify({ type: 'ROOMS_UPDATED', rooms })}\n\n`);
          if (typeof (res as any).flush === 'function') (res as any).flush();
          sseClients.add(res);

          const pingInterval = setInterval(() => {
            try {
              res.write(': ping\n\n');
            } catch {
              clearInterval(pingInterval);
              sseClients.delete(res);
            }
          }, 15000);

          req.on('close', () => {
            clearInterval(pingInterval);
            sseClients.delete(res);
          });
          return;
        }

        // 2. GET /api/live-rooms: list all rooms
        if ((url === '/api/live-rooms' || url === '/api/live-rooms/') && req.method === 'GET') {
          return sendJson(res, 200, rooms);
        }

        // 3. POST /api/live-rooms: create room
        if ((url === '/api/live-rooms' || url === '/api/live-rooms/') && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const newRoom: LiveRoom = body.room;

          if (!newRoom || !newRoom.id) {
            return sendJson(res, 400, { error: 'Invalid room payload' });
          }

          const existingIndex = rooms.findIndex((r) => r.id === newRoom.id);
          if (existingIndex >= 0) {
            rooms[existingIndex] = newRoom;
          } else {
            rooms.unshift(newRoom);
          }

          broadcastEvent({ type: 'ROOMS_UPDATED', rooms, room: newRoom });
          return sendJson(res, 201, { success: true, room: newRoom, rooms });
        }

        // 4. GET /api/live-rooms/:roomId
        const singleRoomMatch = url.match(/^\/api\/live-rooms\/([^/?]+)$/);
        if (singleRoomMatch && req.method === 'GET') {
          const targetId = singleRoomMatch[1];
          const found = rooms.find((r) => r.id === targetId);
          if (!found) {
            return sendJson(res, 404, { error: 'Room not found' });
          }
          return sendJson(res, 200, found);
        }

        // 5. DELETE /api/live-rooms/:roomId (end room)
        if (singleRoomMatch && req.method === 'DELETE') {
          const targetId = singleRoomMatch[1];
          const index = rooms.findIndex((r) => r.id === targetId);
          if (index >= 0) {
            rooms.splice(index, 1);
            roomMessages.delete(targetId);
            broadcastEvent({ type: 'ROOM_ENDED', roomId: targetId, rooms });
          }
          return sendJson(res, 200, { success: true, rooms });
        }

        // 6. POST /api/live-rooms/:roomId/join
        const joinMatch = url.match(/^\/api\/live-rooms\/([^/]+)\/join$/);
        if (joinMatch && req.method === 'POST') {
          const targetId = joinMatch[1];
          const body = await parseJsonBody(req);
          const member: RoomMember = body.member;
          const targetRoom = rooms.find((r) => r.id === targetId);

          if (!targetRoom) {
            return sendJson(res, 404, { error: 'Room not found' });
          }

          if (targetRoom.isLocked) {
            return sendJson(res, 403, { error: 'Room is locked' });
          }

          const alreadyMember = targetRoom.members.some((m) => m.id === member.id);
          if (!alreadyMember) {
            if (targetRoom.members.length >= targetRoom.maxMembers) {
              return sendJson(res, 400, { error: 'Room is full' });
            }
            targetRoom.members.push(member);
            targetRoom.updatedAt = Date.now();
          }

          broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom, rooms });
          return sendJson(res, 200, { success: true, room: targetRoom });
        }

        // 7. POST /api/live-rooms/:roomId/leave
        const leaveMatch = url.match(/^\/api\/live-rooms\/([^/]+)\/leave$/);
        if (leaveMatch && req.method === 'POST') {
          const targetId = leaveMatch[1];
          const body = await parseJsonBody(req);
          const userId = body.userId;
          const targetRoom = rooms.find((r) => r.id === targetId);

          if (!targetRoom) {
            return sendJson(res, 200, { success: true, rooms });
          }

          targetRoom.members = targetRoom.members.filter((m) => m.id !== userId);
          if (targetRoom.activeScreenShareUser === userId) {
            targetRoom.activeScreenShareUser = null;
          }

          // If no members left and not seed room, delete room
          if (targetRoom.members.length === 0 && !targetRoom.id.startsWith('room-acoustic-lounge')) {
            const index = rooms.findIndex((r) => r.id === targetId);
            if (index >= 0) rooms.splice(index, 1);
            roomMessages.delete(targetId);
            broadcastEvent({ type: 'ROOM_ENDED', roomId: targetId, rooms });
            return sendJson(res, 200, { success: true, roomEnded: true, rooms });
          }

          // If host left, promote next member
          if (targetRoom.ownerId === userId && targetRoom.members.length > 0) {
            const newOwner = targetRoom.members[0];
            newOwner.role = 'owner';
            targetRoom.ownerId = newOwner.id;
            targetRoom.ownerName = newOwner.username;
            targetRoom.ownerAvatar = newOwner.avatarUrl;
          }

          targetRoom.updatedAt = Date.now();
          broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom, rooms });
          return sendJson(res, 200, { success: true, room: targetRoom });
        }

        // 8. POST /api/live-rooms/:roomId/kick
        const kickMatch = url.match(/^\/api\/live-rooms\/([^/]+)\/kick$/);
        if (kickMatch && req.method === 'POST') {
          const targetId = kickMatch[1];
          const body = await parseJsonBody(req);
          const { ownerId, targetUserId } = body;
          const targetRoom = rooms.find((r) => r.id === targetId);

          if (!targetRoom || targetRoom.ownerId !== ownerId) {
            return sendJson(res, 403, { error: 'Unauthorized to kick' });
          }

          targetRoom.members = targetRoom.members.filter((m) => m.id !== targetUserId);
          if (targetRoom.activeScreenShareUser === targetUserId) {
            targetRoom.activeScreenShareUser = null;
          }
          targetRoom.updatedAt = Date.now();

          broadcastEvent({
            type: 'MEMBER_KICKED',
            roomId: targetId,
            kickedUserId: targetUserId,
            room: targetRoom,
          });
          broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom, rooms });
          return sendJson(res, 200, { success: true, room: targetRoom });
        }

        // 9. POST /api/live-rooms/:roomId/media
        const mediaMatch = url.match(/^\/api\/live-rooms\/([^/]+)\/media$/);
        if (mediaMatch && req.method === 'POST') {
          const targetId = mediaMatch[1];
          const body = await parseJsonBody(req);
          const { userId, mediaState } = body;
          const targetRoom = rooms.find((r) => r.id === targetId);

          if (!targetRoom) {
            return sendJson(res, 404, { error: 'Room not found' });
          }

          const member = targetRoom.members.find((m) => m.id === userId);
          if (member) {
            if (mediaState.isMuted !== undefined) member.isMuted = mediaState.isMuted;
            if (mediaState.isCameraOn !== undefined) member.isCameraOn = mediaState.isCameraOn;
            if (mediaState.isSpeaking !== undefined) member.isSpeaking = mediaState.isSpeaking;
            if (mediaState.audioLevel !== undefined) member.audioLevel = mediaState.audioLevel;
            if (mediaState.isScreenSharing !== undefined) {
              member.isScreenSharing = mediaState.isScreenSharing;
              if (mediaState.isScreenSharing) {
                targetRoom.activeScreenShareUser = userId;
              } else if (targetRoom.activeScreenShareUser === userId) {
                targetRoom.activeScreenShareUser = null;
              }
            }
            targetRoom.updatedAt = Date.now();
            broadcastEvent({ type: 'MEDIA_STATE_CHANGED', roomId: targetId, room: targetRoom });
            broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom, rooms });
          }

          return sendJson(res, 200, { success: true, room: targetRoom });
        }

        // 10. POST /api/live-rooms/:roomId/settings
        const settingsMatch = url.match(/^\/api\/live-rooms\/([^/]+)\/settings$/);
        if (settingsMatch && req.method === 'POST') {
          const targetId = settingsMatch[1];
          const body = await parseJsonBody(req);
          const { ownerId, name, description, isLocked } = body;
          const targetRoom = rooms.find((r) => r.id === targetId);

          if (!targetRoom || targetRoom.ownerId !== ownerId) {
            return sendJson(res, 403, { error: 'Unauthorized to update settings' });
          }

          if (name) targetRoom.name = name.trim();
          if (description !== undefined) targetRoom.description = description.trim();
          if (isLocked !== undefined) targetRoom.isLocked = isLocked;
          targetRoom.updatedAt = Date.now();

          broadcastEvent({ type: 'ROOM_UPDATED', room: targetRoom, rooms });
          return sendJson(res, 200, { success: true, room: targetRoom });
        }

        // 11. GET & POST /api/live-rooms/:roomId/messages
        const messagesMatch = url.match(/^\/api\/live-rooms\/([^/]+)\/messages$/);
        if (messagesMatch) {
          const targetId = messagesMatch[1];
          if (req.method === 'GET') {
            const list = roomMessages.get(targetId) || [];
            return sendJson(res, 200, list);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const msg: RoomChatMessage = body.message;
            if (!msg || !msg.id) {
              return sendJson(res, 400, { error: 'Invalid message payload' });
            }

            const current = roomMessages.get(targetId) || [];
            current.push(msg);
            if (current.length > 200) current.shift();
            roomMessages.set(targetId, current);

            broadcastEvent({ type: 'CHAT_MESSAGE', roomId: targetId, message: msg });
            return sendJson(res, 201, { success: true, message: msg });
          }
        }

        // 12. POST /api/live-rooms/:roomId/drum-hit
        const drumHitMatch = url.match(/^\/api\/live-rooms\/([^/]+)\/drum-hit$/);
        if (drumHitMatch && req.method === 'POST') {
          const targetId = drumHitMatch[1];
          const body = await parseJsonBody(req);
          broadcastEvent({ type: 'DRUM_HIT', roomId: targetId, hit: body.hit });
          return sendJson(res, 200, { success: true });
        }

        // 13. POST /api/live-rooms/:roomId/signal (WebRTC P2P relay)
        const signalMatch = url.match(/^\/api\/live-rooms\/([^/]+)\/signal$/);
        if (signalMatch && req.method === 'POST') {
          const targetId = signalMatch[1];
          const body = await parseJsonBody(req);
          const { from, to, signal } = body;
          broadcastEvent({
            type: 'WEBRTC_SIGNAL',
            roomId: targetId,
            from,
            to,
            signal,
          });
          return sendJson(res, 200, { success: true });
        }

        next();
      });
    },
  };
}
