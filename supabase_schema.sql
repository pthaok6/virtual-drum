-- ==============================================================================
-- VIRTUAL DRUM - SUPABASE DATABASE & REALTIME SETUP
-- Copy and paste this script into your Supabase project SQL Editor and click RUN.
-- ==============================================================================

-- 1. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  total_score BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to automatically create a profile entry when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. SONGS TABLE (Uploaded audio tracks & generated charts)
CREATE TABLE IF NOT EXISTS public.songs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  bpm INT NOT NULL,
  duration_seconds FLOAT NOT NULL,
  start_seconds FLOAT NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'Easy',
  audio_url TEXT NOT NULL,
  beat_times JSONB DEFAULT '[]'::jsonb,
  analysis_notes JSONB DEFAULT '[]'::jsonb,
  demo_analysis BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Songs are viewable by everyone"
  ON public.songs FOR SELECT
  USING (true);

CREATE POLICY "Anyone or authenticated users can insert songs"
  ON public.songs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can update or delete their songs"
  ON public.songs FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);


-- 3. ROOMS TABLE (Multiplayer matchmaking & lobbies)
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 4,
  challenge_id TEXT DEFAULT 'beginner-beat',
  challenge_title TEXT DEFAULT 'Beginner Beat',
  mode TEXT DEFAULT 'versus',
  status TEXT DEFAULT 'waiting',
  color TEXT DEFAULT 'rose',
  players_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms are viewable by everyone"
  ON public.rooms FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create or join rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Host can update room status or settings"
  ON public.rooms FOR UPDATE
  USING (true);

CREATE POLICY "Host can delete room"
  ON public.rooms FOR DELETE
  USING (true);

-- Enable Realtime publication for tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'songs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
  END IF;
END $$;


-- 4. STORAGE BUCKET: songs
-- Creates the public storage bucket for uploaded drum audio tracks.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'songs',
  'songs',
  true,
  52428800, -- 50 MB
  ARRAY['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/x-wav']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Storage RLS policies for the 'songs' bucket
CREATE POLICY "Public Access to Songs Bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'songs');

CREATE POLICY "Allow Song Uploads to Songs Bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'songs');

CREATE POLICY "Allow Song Deletion from Songs Bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'songs');

