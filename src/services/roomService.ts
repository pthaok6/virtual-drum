import { supabase, isSupabaseConfigured } from './supabase';
import { ROOMS as DEMO_ROOMS } from '../data/community';
import { createId } from './id';

export interface RoomData {
  id: string;
  name: string;
  host: string;
  hostId: string;
  players: number;
  capacity: number;
  challenge: string;
  challengeId?: string;
  mode?: 'versus' | 'together';
  status: 'Waiting' | 'Playing' | 'Finished';
  color?: string;
  createdAt?: string;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready?: boolean;
  joinedAt: string;
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
}

// Local in-memory / localStorage cache for rooms
const ROOMS_CACHE_KEY = 'virtual-drum-custom-rooms';
let memoryRooms: RoomData[] = [];

function getLocalRooms(): RoomData[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ROOMS_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return memoryRooms;
}

function saveLocalRooms(rooms: RoomData[]) {
  memoryRooms = rooms;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(rooms));
    }
  } catch {}
}

export async function fetchRooms(): Promise<RoomData[]> {
  const localCustom = getLocalRooms();
  const demoList = DEMO_ROOMS.map(r => ({
    id: r.id,
    name: r.name,
    host: r.host,
    hostId: r.host.toLowerCase().replace(/\s+/g, '-'),
    players: r.players,
    capacity: r.capacity,
    challenge: r.challenge,
    status: r.status as 'Waiting' | 'Playing' | 'Finished',
    color: r.color,
  }));

  if (!isSupabaseConfigured || !supabase) {
    const merged = [...localCustom, ...demoList.filter(d => !localCustom.some(c => c.id === d.id))];
    return merged;
  }

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Supabase fetchRooms fallback to local/demo:', error?.message);
      return [...localCustom, ...demoList.filter(d => !localCustom.some(c => c.id === d.id))];
    }

    const remoteRooms: RoomData[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      host: row.host_name || 'Host',
      hostId: row.host_id || 'host',
      players: row.players_count ?? 1,
      capacity: row.capacity ?? 4,
      challenge: row.challenge_title || 'Beginner Beat',
      challengeId: row.challenge_id || 'beginner-beat',
      mode: row.mode || 'versus',
      status: (row.status === 'playing' ? 'Playing' : row.status === 'finished' ? 'Finished' : 'Waiting'),
      color: row.color || 'rose',
      createdAt: row.created_at,
    }));

    // Merge remote with demo rooms for a lively initial list
    const combined = [...remoteRooms, ...demoList.filter(d => !remoteRooms.some(r => r.id === d.id))];
    return combined;
  } catch (err) {
    console.warn('fetchRooms exception:', err);
    return [...localCustom, ...demoList.filter(d => !localCustom.some(c => c.id === d.id))];
  }
}

export async function createRoom(params: {
  name: string;
  hostName: string;
  hostId: string;
  challengeId?: string;
  challengeTitle?: string;
  mode?: 'versus' | 'together';
  capacity?: number;
}): Promise<RoomData> {
  const roomId = 'room-' + createId();
  const newRoom: RoomData = {
    id: roomId,
    name: params.name.trim(),
    host: params.hostName || 'You',
    hostId: params.hostId || 'you',
    players: 1,
    capacity: params.capacity || 4,
    challenge: params.challengeTitle || 'Beginner Beat',
    challengeId: params.challengeId || 'beginner-beat',
    mode: params.mode || 'versus',
    status: 'Waiting',
    color: 'rose',
    createdAt: new Date().toISOString(),
  };

  // 1. Save locally
  const current = getLocalRooms();
  saveLocalRooms([newRoom, ...current]);

  // 2. Save in Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('rooms').insert({
        id: roomId,
        name: newRoom.name,
        host_id: newRoom.hostId,
        host_name: newRoom.host,
        capacity: newRoom.capacity,
        challenge_id: newRoom.challengeId,
        challenge_title: newRoom.challenge,
        mode: newRoom.mode,
        status: 'waiting',
      });
    } catch (err) {
      console.warn('Failed to insert room into Supabase:', err);
    }
  }

  return newRoom;
}

export async function updateRoomStatus(roomId: string, status: 'Waiting' | 'Playing' | 'Finished'): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('rooms').update({ status: status.toLowerCase() }).eq('id', roomId);
    } catch (err) {
      console.warn('Failed to update room status:', err);
    }
  }
}
