-- ==============================================================================
-- VIRTUAL DRUM PRO - SUPABASE DATABASE SCHEMA
-- Hướng dẫn cài đặt trên Supabase (https://supabase.com):
-- 1. Đăng nhập vào Supabase và chọn hoặc tạo mới một Project.
-- 2. Vào mục "SQL Editor" ở menu thanh bên trái.
-- 3. Bấm "New Query", dán toàn bộ nội dung file này vào và bấm "Run".
-- 4. Vào mục "Project Settings" -> "API" để lấy:
--    - Project URL (VITE_SUPABASE_URL)
--    - Project API keys -> anon/public (VITE_SUPABASE_ANON_KEY)
-- 5. Cấu hình vào file .env hoặc điền trực tiếp trong giao diện ứng dụng.
-- ==============================================================================

-- 1. BẢNG HỒ SƠ NGƯỜI DÙNG (PUBLIC.PROFILES)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  username text not null,
  avatar_url text,
  level integer default 1,
  total_score integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Kích hoạt Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policy: Mọi người đều có thể đọc thông tin hồ sơ (để hiển thị trên bảng xếp hạng, v.v.)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

-- Policy: Người dùng có thể tự tạo profile của mình
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Policy: Người dùng có thể cập nhật profile của mình
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- 2. TRIGGER TỰ ĐỘNG TẠO PROFILE KHI ĐĂNG KÝ USER MỚI QUA SUPABASE AUTH
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_user_name text;
begin
  raw_user_name := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(coalesce(new.email, 'Drummer'), '@', 1)
  );

  insert into public.profiles (id, email, username, avatar_url, level, total_score)
  values (
    new.id,
    new.email,
    raw_user_name,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/bottts/svg?seed=' || raw_user_name
    ),
    coalesce((new.raw_user_meta_data->>'level')::int, 1),
    coalesce((new.raw_user_meta_data->>'total_score')::int, 0)
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(excluded.username, profiles.username),
    updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

-- Gắn trigger vào bảng auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. BẢNG LƯU KẾT QUẢ VÀ ĐIỂM CHƠI (PUBLIC.PLAY_RECORDS)
create table if not exists public.play_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  username text not null,
  avatar_url text,
  track_id text not null,
  track_title text not null,
  score integer not null,
  accuracy real not null,
  max_combo integer not null,
  rank text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Kích hoạt Row Level Security cho play_records
alter table public.play_records enable row level security;

-- Policy: Mọi người có thể xem toàn bộ bảng xếp hạng
drop policy if exists "Leaderboard is viewable by everyone" on public.play_records;
create policy "Leaderboard is viewable by everyone" on public.play_records
  for select using (true);

-- Policy: Bất kỳ ai (đã đăng nhập hoặc khách) đều có thể ghi điểm
drop policy if exists "Anyone can insert play records" on public.play_records;
create policy "Anyone can insert play records" on public.play_records
  for insert with check (true);

-- Index tối ưu tốc độ tải Leaderboard
create index if not exists idx_play_records_track_score on public.play_records (track_id, score desc);
create index if not exists idx_play_records_user on public.play_records (user_id);
create index if not exists idx_play_records_created on public.play_records (created_at desc);

-- 4. BẢNG LƯU BẢN THU ÂM RIÊNG CỦA TỪNG TÀI KHOẢN (PUBLIC.USER_RECORDINGS)
create table if not exists public.user_recordings (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  author_name text not null,
  preset text not null default 'acoustic',
  duration_ms integer not null,
  hits jsonb not null default '[]'::jsonb,
  stats jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Kích hoạt Row Level Security cho user_recordings
alter table public.user_recordings enable row level security;

-- Policy: Mỗi tài khoản chỉ xem được bản thu của chính mình
drop policy if exists "Users can select own recordings" on public.user_recordings;
create policy "Users can select own recordings" on public.user_recordings
  for select using (auth.uid() = user_id);

-- Policy: Mỗi tài khoản chỉ chèn được bản thu của chính mình
drop policy if exists "Users can insert own recordings" on public.user_recordings;
create policy "Users can insert own recordings" on public.user_recordings
  for insert with check (auth.uid() = user_id);

-- Policy: Mỗi tài khoản chỉ cập nhật được bản thu của chính mình
drop policy if exists "Users can update own recordings" on public.user_recordings;
create policy "Users can update own recordings" on public.user_recordings
  for update using (auth.uid() = user_id);

-- Policy: Mỗi tài khoản chỉ xóa được bản thu của chính mình
drop policy if exists "Users can delete own recordings" on public.user_recordings;
create policy "Users can delete own recordings" on public.user_recordings
  for delete using (auth.uid() = user_id);

create index if not exists idx_user_recordings_user on public.user_recordings (user_id);
create index if not exists idx_user_recordings_created on public.user_recordings (created_at desc);

-- Thông báo hoàn thành
do $$
begin
  raise notice 'Đã thiết lập bảng profiles, play_records, user_recordings và trigger Supabase thành công!';
end $$;

