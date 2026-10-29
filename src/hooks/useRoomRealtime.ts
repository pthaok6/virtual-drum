import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { RhythmChallenge } from '../types';
import type { RoomPlayer, RoomChatMessage } from '../services/roomService';
import { createId } from '../services/id';

interface UseRoomRealtimeProps {
  roomId: string;
  roomName: string;
  user: { id: string; name: string };
  isInitialHost: boolean;
  onGameStart?: (challenge: RhythmChallenge, session: { roomName: string; mode: 'versus' | 'together'; roomId: string; players?: RoomPlayer[]; isHost?: boolean }) => void;
  onRemoteSettingsChange?: (update: { challengeId?: string; mode?: 'versus' | 'together' }) => void;
}

export function useRoomRealtime({
  roomId,
  roomName,
  user,
  isInitialHost,
  onGameStart,
  onRemoteSettingsChange,
}: UseRoomRealtimeProps) {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [isHost, setIsHost] = useState(isInitialHost);

  const channelRef = useRef<any>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Cross-tab broadcast channel for local testing / offline fallback
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(`virtual-drum-room-${roomId}`);
        broadcastChannelRef.current = bc;

        bc.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'GAME_START') {
            onGameStart?.(payload.challenge, {
              roomName: payload.roomName || roomName,
              mode: payload.mode || 'versus',
              roomId,
              players: payload.players || [],
              isHost: user.id === payload.hostId,
            });
          } else if (type === 'ROOM_UPDATE') {
            onRemoteSettingsChange?.(payload);
          } else if (type === 'CHAT_MESSAGE') {
            setChatMessages((prev) => [...prev, payload]);
          } else if (type === 'PLAYER_JOIN') {
            setPlayers((prev) => {
              if (prev.some((p) => p.id === payload.id)) return prev;
              return [...prev, payload];
            });
          } else if (type === 'PLAYER_LEAVE') {
            setPlayers((prev) => prev.filter((p) => p.id !== payload.id));
          } else if (type === 'PLAYER_READY') {
            setPlayers((prev) =>
              prev.map((p) => (p.id === payload.id ? { ...p, ready: payload.ready } : p))
            );
          }
        };
      }
    } catch {}

    return () => {
      bc?.close();
      broadcastChannelRef.current = null;
    };
  }, [roomId, roomName, onGameStart, onRemoteSettingsChange]);

  // Connect to Supabase Realtime channel if configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !roomId) {
      return;
    }

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });
    channelRef.current = channel;

    // Listen to Presence state
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const onlinePlayers: RoomPlayer[] = [];

      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => {
          if (p && p.id) {
            onlinePlayers.push({
              id: p.id,
              name: p.name || 'Drummer',
              isHost: Boolean(p.isHost),
              ready: Boolean(p.ready),
              joinedAt: p.joinedAt || new Date().toISOString(),
            });
          }
        });
      });

      // Deduplicate by ID
      const uniquePlayers = Array.from(new Map(onlinePlayers.map((p) => [p.id, p])).values());
      setPlayers(uniquePlayers);

      // If no host in room, first player becomes host
      if (uniquePlayers.length > 0 && !uniquePlayers.some((p) => p.isHost)) {
        if (uniquePlayers[0].id === user.id) {
          setIsHost(true);
        }
      }
    });

    // Listen to Broadcast events
    channel.on('broadcast', { event: 'game_start' }, ({ payload }: any) => {
      if (payload && payload.challenge) {
        onGameStart?.(payload.challenge, {
          roomName: payload.roomName || roomName,
          mode: payload.mode || 'versus',
          roomId,
          players: payload.players || [],
          isHost: user.id === payload.hostId,
        });
      }
    });

    channel.on('broadcast', { event: 'room_update' }, ({ payload }: any) => {
      if (payload) {
        onRemoteSettingsChange?.(payload);
      }
    });

    channel.on('broadcast', { event: 'chat_message' }, ({ payload }: any) => {
      if (payload) {
        setChatMessages((prev) => [...prev, payload]);
      }
    });

    channel.on('broadcast', { event: 'player_ready' }, ({ payload }: any) => {
      if (payload) {
        setPlayers((prev) =>
          prev.map((p) => (p.id === payload.id ? { ...p, ready: payload.ready } : p))
        );
      }
    });

    channel.subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId, user.id, user.name, roomName, onGameStart, onRemoteSettingsChange]);

  const joinRoom = useCallback(async () => {
    setIsJoined(true);
    const selfPlayer: RoomPlayer = {
      id: user.id,
      name: user.name,
      isHost,
      ready: isHost ? true : false,
      joinedAt: new Date().toISOString(),
    };

    // Track with Supabase Presence
    if (channelRef.current) {
      try {
        await channelRef.current.track(selfPlayer);
      } catch (err) {
        console.warn('Supabase presence track error:', err);
      }
    }

    // Local / cross-tab broadcast
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'PLAYER_JOIN',
          payload: selfPlayer,
        });
      } catch {}
    }

    setPlayers((prev) => {
      if (prev.some((p) => p.id === user.id)) return prev;
      return [...prev, selfPlayer];
    });
  }, [user.id, user.name, isHost]);

  const leaveRoom = useCallback(async () => {
    setIsJoined(false);

    if (channelRef.current) {
      try {
        await channelRef.current.untrack();
      } catch {}
    }

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'PLAYER_LEAVE',
          payload: { id: user.id },
        });
      } catch {}
    }

    setPlayers((prev) => prev.filter((p) => p.id !== user.id));
  }, [user.id]);

  const toggleReady = useCallback(
    async (ready: boolean) => {
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'player_ready',
            payload: { id: user.id, ready },
          });
          // Update own presence
          await channelRef.current.track({
            id: user.id,
            name: user.name,
            isHost,
            ready,
            joinedAt: new Date().toISOString(),
          });
        } catch {}
      }

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'PLAYER_READY',
            payload: { id: user.id, ready },
          });
        } catch {}
      }

      setPlayers((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, ready } : p))
      );
    },
    [user.id, user.name, isHost]
  );

  const broadcastStartGame = useCallback(
    async (challenge: RhythmChallenge, mode: 'versus' | 'together', playersList?: RoomPlayer[]) => {
      const activePlayers = playersList && playersList.length > 0 ? playersList : (players.length > 0 ? players : [
        { id: user.id, name: user.name, isHost: true, ready: true, joinedAt: new Date().toISOString() }
      ]);
      const payload = {
        challenge,
        mode,
        roomName,
        roomId,
        players: activePlayers,
        hostId: user.id,
      };

      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'game_start',
            payload,
          });
        } catch (err) {
          console.warn('broadcast start game error:', err);
        }
      }

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'GAME_START',
            payload,
          });
        } catch {}
      }

      onGameStart?.(challenge, {
        roomName,
        mode,
        roomId,
        players: activePlayers,
        isHost: true,
      });
    },
    [roomName, roomId, onGameStart, players, user.id, user.name]
  );

  const broadcastRoomUpdate = useCallback(
    async (update: { challengeId?: string; mode?: 'versus' | 'together' }) => {
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'room_update',
            payload: update,
          });
        } catch {}
      }

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'ROOM_UPDATE',
            payload: update,
          });
        } catch {}
      }
    },
    []
  );

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const msg: RoomChatMessage = {
        id: createId(),
        senderId: user.id,
        senderName: user.name,
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'chat_message',
            payload: msg,
          });
        } catch {}
      }

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'CHAT_MESSAGE',
            payload: msg,
          });
        } catch {}
      }

      setChatMessages((prev) => [...prev, msg]);
    },
    [user.id, user.name]
  );

  return {
    players,
    isJoined,
    isHost,
    chatMessages,
    joinRoom,
    leaveRoom,
    toggleReady,
    broadcastStartGame,
    broadcastRoomUpdate,
    sendChatMessage,
  };
}

