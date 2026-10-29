import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { DrumType, HitRating } from '../types';
import { audioEngine } from '../services/audio';

export interface MultiplayerPlayer {
  id: string;
  name: string;
  isHost?: boolean;
}

export interface OpponentState {
  id: string;
  name: string;
  score: number;
  combo: number;
  accuracy: number;
  currentNoteIndex: number;
  totalNotes: number;
  lastHit?: { drum: DrumType; rating: HitRating } | null;
  activeHits?: Record<DrumType, { isHit: boolean; rating?: HitRating }>;
  finished?: boolean;
}

export interface CoopHitEvent {
  senderId: string;
  senderName: string;
  drum: DrumType;
  rating: HitRating;
  noteIndex: number;
  teamScore: number;
  teamCombo: number;
}

interface UseMultiplayerGameProps {
  roomId?: string;
  mode?: 'versus' | 'together';
  currentUserId: string;
  currentUserName: string;
  players?: MultiplayerPlayer[];
  onRemoteCoopHit?: (event: CoopHitEvent) => void;
}

export function useMultiplayerGame({
  roomId,
  mode = 'versus',
  currentUserId,
  currentUserName,
  players = [],
  onRemoteCoopHit,
}: UseMultiplayerGameProps) {
  const [opponent, setOpponent] = useState<OpponentState | null>(null);
  const [teamScore, setTeamScore] = useState(0);
  const [teamCombo, setTeamCombo] = useState(0);

  const channelRef = useRef<any>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Identify opponent
  const effectiveOpponent = players.find((p) => p.id !== currentUserId) || {
    id: 'opponent',
    name: 'Player 2',
  };

  useEffect(() => {
    if (!roomId) return;

    // 1. Cross-tab BroadcastChannel for instant local testing / fallback
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(`virtual-drum-match-${roomId}`);
        broadcastChannelRef.current = bc;

        bc.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (payload?.senderId === currentUserId) return; // ignore self

          if (type === 'VERSUS_UPDATE') {
            setOpponent({
              id: payload.senderId,
              name: payload.senderName || effectiveOpponent.name,
              score: payload.score ?? 0,
              combo: payload.combo ?? 0,
              accuracy: payload.accuracy ?? 100,
              currentNoteIndex: payload.currentNoteIndex ?? 0,
              totalNotes: payload.totalNotes ?? 1,
              lastHit: payload.lastHit,
              activeHits: payload.activeHits,
              finished: payload.finished,
            });
          } else if (type === 'COOP_HIT') {
            // Play opponent's drum sound!
            if (payload.drum) {
              audioEngine.playDrum(payload.drum);
            }
            if (payload.teamScore !== undefined) setTeamScore(payload.teamScore);
            if (payload.teamCombo !== undefined) setTeamCombo(payload.teamCombo);
            onRemoteCoopHit?.(payload);
          }
        };
      }
    } catch {}

    // 2. Supabase Realtime channel if configured
    if (isSupabaseConfigured && supabase) {
      const channel = supabase.channel(`match:${roomId}`);
      channelRef.current = channel;

      channel.on('broadcast', { event: 'versus_update' }, ({ payload }: any) => {
        if (!payload || payload.senderId === currentUserId) return;
        setOpponent({
          id: payload.senderId,
          name: payload.senderName || effectiveOpponent.name,
          score: payload.score ?? 0,
          combo: payload.combo ?? 0,
          accuracy: payload.accuracy ?? 100,
          currentNoteIndex: payload.currentNoteIndex ?? 0,
          totalNotes: payload.totalNotes ?? 1,
          lastHit: payload.lastHit,
          activeHits: payload.activeHits,
          finished: payload.finished,
        });
      });

      channel.on('broadcast', { event: 'coop_hit' }, ({ payload }: any) => {
        if (!payload || payload.senderId === currentUserId) return;
        if (payload.drum) {
          audioEngine.playDrum(payload.drum);
        }
        if (payload.teamScore !== undefined) setTeamScore(payload.teamScore);
        if (payload.teamCombo !== undefined) setTeamCombo(payload.teamCombo);
        onRemoteCoopHit?.(payload);
      });

      channel.subscribe();
    }

    return () => {
      bc?.close();
      broadcastChannelRef.current = null;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [roomId, currentUserId, effectiveOpponent.name, onRemoteCoopHit]);

  // Send update in Versus mode
  const sendVersusProgress = useCallback(
    (progress: {
      score: number;
      combo: number;
      accuracy: number;
      currentNoteIndex: number;
      totalNotes: number;
      lastHit?: { drum: DrumType; rating: HitRating } | null;
      activeHits?: Record<DrumType, { isHit: boolean; rating?: HitRating }>;
      finished?: boolean;
    }) => {
      if (!roomId) return;
      const payload = {
        senderId: currentUserId,
        senderName: currentUserName,
        ...progress,
      };

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'VERSUS_UPDATE', payload });
        } catch {}
      }

      if (channelRef.current) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'versus_update',
            payload,
          });
        } catch {}
      }
    },
    [roomId, currentUserId, currentUserName]
  );

  // Send hit in Together / Co-op mode
  const sendCoopHit = useCallback(
    (data: {
      drum: DrumType;
      rating: HitRating;
      noteIndex: number;
      teamScore: number;
      teamCombo: number;
    }) => {
      if (!roomId) return;
      const payload: CoopHitEvent = {
        senderId: currentUserId,
        senderName: currentUserName,
        ...data,
      };

      setTeamScore(data.teamScore);
      setTeamCombo(data.teamCombo);

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'COOP_HIT', payload });
        } catch {}
      }

      if (channelRef.current) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'coop_hit',
            payload,
          });
        } catch {}
      }
    },
    [roomId, currentUserId, currentUserName]
  );

  return {
    opponent,
    teamScore,
    teamCombo,
    setTeamScore,
    setTeamCombo,
    sendVersusProgress,
    sendCoopHit,
  };
}

