import { supabase, isSupabaseConfigured } from './supabase';
import type { SavedSong } from './songLibrary';
import type { DrumType } from '../types';

export interface RemoteSongRow {
  id: string;
  user_id: string | null;
  title: string;
  bpm: number;
  duration_seconds: number;
  start_seconds: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  audio_url: string;
  beat_times?: number[];
  analysis_notes?: { time: number; lane: DrumType }[];
  demo_analysis?: boolean;
  created_at?: string;
}

export async function uploadSongToSupabase(
  song: SavedSong,
  userId?: string | null
): Promise<{ audioUrl: string | null; error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { audioUrl: null, error: null };
  }

  try {
    const fileExt = song.file.type.includes('wav') ? 'wav' : song.file.type.includes('mp3') ? 'mp3' : 'audio';
    const filePath = `${userId || 'guest'}/${song.id}.${fileExt}`;

    // 1. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('songs')
      .upload(filePath, song.file, {
        contentType: song.file.type || 'audio/wav',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase storage upload error:', uploadError.message);
      return { audioUrl: null, error: new Error(uploadError.message) };
    }

    const { data: urlData } = supabase.storage.from('songs').getPublicUrl(filePath);
    const audioUrl = urlData.publicUrl;

    // 2. Insert record in 'songs' table
    const { error: dbError } = await supabase.from('songs').upsert({
      id: song.id,
      user_id: userId || null,
      title: song.title,
      bpm: song.bpm,
      duration_seconds: song.durationSeconds,
      start_seconds: song.startSeconds,
      difficulty: song.difficulty,
      audio_url: audioUrl,
      beat_times: song.beatTimes || [],
      analysis_notes: song.analysisNotes || [],
      demo_analysis: Boolean(song.demoAnalysis),
    });

    if (dbError) {
      console.warn('Supabase DB songs insert error:', dbError.message);
      return { audioUrl, error: new Error(dbError.message) };
    }

    return { audioUrl, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Failed to upload song to Supabase');
    console.warn('Error in uploadSongToSupabase:', error);
    return { audioUrl: null, error };
  }
}

export async function fetchRemoteSongs(): Promise<RemoteSongRow[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchRemoteSongs error:', error.message);
      return [];
    }

    return (data as RemoteSongRow[]) || [];
  } catch (err) {
    console.warn('Supabase fetchRemoteSongs failed:', err);
    return [];
  }
}

export async function deleteRemoteSong(id: string, userId?: string | null): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  try {
    // Delete from DB table
    await supabase.from('songs').delete().eq('id', id);

    // Try deleting from Storage
    const userPrefix = userId || 'guest';
    await supabase.storage.from('songs').remove([
      `${userPrefix}/${id}.wav`,
      `${userPrefix}/${id}.mp3`,
      `guest/${id}.wav`,
      `guest/${id}.mp3`,
    ]);
  } catch (err) {
    console.warn('Supabase deleteRemoteSong error:', err);
  }
}

