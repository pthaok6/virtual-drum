import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  LogIn,
  UserPlus,
  LogOut,
  Award,
  Sparkles,
  CheckCircle2,
  Database,
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Server,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const SQL_SCHEMA_SNIPPET = `-- Chạy đoạn mã này trong Supabase Dashboard -> SQL Editor:
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

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, avatar_url, level, total_score)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
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

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

alter table public.play_records enable row level security;
create policy "Leaderboard is viewable by everyone" on public.play_records for select using (true);
create policy "Anyone can insert play records" on public.play_records for insert with check (true);
`;

export const AuthModal: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isAuthModalOpen,
    closeAuthModal,
    login,
    register,
    logout,
    isSupabaseConfigured,
    supabaseConfig,
    saveSupabaseConfig,
    testSupabase,
  } = useAuth();

  const [tab, setTab] = useState<'login' | 'register' | 'config'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Config tab state
  const [inputUrl, setInputUrl] = useState(supabaseConfig.url || '');
  const [inputKey, setInputKey] = useState(supabaseConfig.anonKey || '');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tableProfilesExists?: boolean;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  useEffect(() => {
    setInputUrl(supabaseConfig.url || '');
    setInputKey(supabaseConfig.anonKey || '');
  }, [supabaseConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Mật khẩu Supabase phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'register') {
        const displayName = username.trim() || email.split('@')[0];
        await register(email, displayName, password);
        setSuccessMessage('Đăng ký tài khoản thành công trên Supabase!');
      } else {
        await login(email, password);
        setSuccessMessage('Đăng nhập thành công!');
      }
      setTimeout(() => {
        setSuccessMessage(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestSupabase = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testSupabase(inputUrl, inputKey);
      setTestResult(res);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Kiểm tra thất bại.',
        tableProfilesExists: false,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async () => {
    await saveSupabaseConfig(inputUrl, inputKey);
    setSuccessMessage('Đã lưu cấu hình Supabase thành công!');
    setTimeout(() => {
      setSuccessMessage(null);
      setTab('login');
    }, 1200);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent
        id="auth-modal-panel"
        className="max-w-lg gap-0 border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl shadow-rose-950/20 sm:max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        <DialogHeader className="border-b border-zinc-800/80 px-6 py-4 bg-gradient-to-r from-zinc-900 to-zinc-950 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{isAuthenticated ? 'Drummer Profile' : 'Tài khoản & Supabase'}</span>
                  {isSupabaseConfigured ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-2 font-mono">
                      Supabase Cloud
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] py-0 px-2 font-mono">
                      Local Mode
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  {isSupabaseConfigured
                    ? 'Lưu trữ thông tin người chơi & điểm số trên Supabase PostgreSQL'
                    : 'Đồng bộ người dùng lên cloud Supabase hoặc lưu cục bộ'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-6 flex-1 space-y-5">
          {/* Status banner */}
          <div
            className={`rounded-xl border p-3 text-xs flex items-center justify-between gap-3 ${
              isSupabaseConfigured
                ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-300'
                : 'border-amber-500/20 bg-amber-950/20 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <div>
                <span className="font-semibold">
                  {isSupabaseConfigured ? 'Supabase Đã Kết Nối' : 'Chưa Kết Nối Supabase'}
                </span>
                <span className="text-zinc-400 ml-1.5 hidden sm:inline">
                  {isSupabaseConfigured
                    ? 'Tài khoản & điểm số được lưu an toàn trên Cloud Supabase.'
                    : 'Đang lưu tạm ở LocalStorage. Hãy cấu hình để lưu vào Supabase.'}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTab(tab === 'config' ? 'login' : 'config')}
              className="h-7 text-[11px] font-medium border-zinc-700 bg-zinc-900/90 text-zinc-200 hover:bg-zinc-800"
            >
              {tab === 'config' ? 'Quay lại' : 'Cài đặt Supabase'}
            </Button>
          </div>

          {/* TAB: PROFILE VIEW (when logged in and not in config tab) */}
          {isAuthenticated && user && tab !== 'config' ? (
            <div className="space-y-5">
              <Card className="flex items-center gap-4 rounded-2xl border-zinc-800 bg-zinc-900/70 p-4">
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="h-16 w-16 rounded-2xl border-2 border-emerald-500/40 bg-zinc-950 p-1 shadow-md shadow-emerald-500/20"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white truncate">{user.username}</h3>
                    <Badge className="bg-amber-400/10 border-amber-400/30 text-amber-400 text-[10px] font-black uppercase">
                      Lv. {user.level}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                    ID: {user.id}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 font-mono text-emerald-400 font-bold">
                      <Sparkles className="h-3.5 w-3.5" />
                      {user.totalScore.toLocaleString()} EXP
                    </span>
                    <span className="flex items-center gap-1 font-mono text-zinc-400">
                      <Award className="h-3.5 w-3.5 text-amber-400" />
                      Rhythm Drummer
                    </span>
                  </div>
                </div>
              </Card>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-xs text-zinc-400 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
                  <Server className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Trạng thái lưu trữ Supabase:</span>
                </div>
                <p>
                  Tài khoản của bạn được liên kết với <strong>auth.users</strong> và bảng{' '}
                  <strong>public.profiles</strong> trên Supabase PostgreSQL.
                </p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTab('config')}
                  className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1.5 text-teal-400" />
                  Xem cấu hình Supabase
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={logout}
                    className="flex items-center gap-2 rounded-xl border-zinc-800 bg-zinc-900 text-rose-400 hover:bg-rose-950/30 hover:border-rose-800 text-xs"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Đăng xuất</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={closeAuthModal}
                    className="rounded-xl bg-zinc-100 font-bold text-zinc-950 hover:bg-white text-xs px-4"
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            </div>
          ) : tab === 'config' ? (
            /* TAB: SUPABASE CONFIGURATION VIEW */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Cấu hình kết nối Supabase</span>
                </div>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                >
                  <span>Mở Supabase Dashboard</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="supabase-url" className="text-xs text-zinc-300">
                    Project URL (VITE_SUPABASE_URL)
                  </Label>
                  <Input
                    id="supabase-url"
                    type="text"
                    placeholder="https://xyzproject.supabase.co"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Lấy tại: Supabase Dashboard → Project Settings → API → Project URL
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supabase-key" className="text-xs text-zinc-300">
                    Anon Public API Key (VITE_SUPABASE_ANON_KEY)
                  </Label>
                  <Input
                    id="supabase-key"
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    className="border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Lấy tại: Supabase Dashboard → Project Settings → API → anon / public key
                  </p>
                </div>
              </div>

              {/* Action buttons for testing & saving */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSupabase}
                  disabled={testingConnection || !inputUrl || !inputKey}
                  className="flex-1 rounded-xl border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${testingConnection ? 'animate-spin text-emerald-400' : ''}`}
                  />
                  <span>{testingConnection ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700"
                >
                  Lưu & Áp dụng
                </Button>
              </div>

              {/* Test result message */}
              {testResult && (
                <div
                  className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
                    testResult.success
                      ? testResult.tableProfilesExists
                        ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
                        : 'border-amber-500/30 bg-amber-950/30 text-amber-200'
                      : 'border-rose-500/30 bg-rose-950/30 text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    testResult.tableProfilesExists ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    )
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">{testResult.message}</p>
                    {testResult.success && !testResult.tableProfilesExists && (
                      <p className="text-[11px] text-amber-300/80">
                        Vui lòng mở phần SQL Schema bên dưới, bấm copy và dán vào Supabase SQL
                        Editor để tạo bảng profiles.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* SQL Schema Expander */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSqlGuide(!showSqlGuide)}
                  className="w-full flex items-center justify-between p-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    <span>Mã lệnh SQL tạo bảng Supabase (schema)</span>
                  </div>
                  <Badge variant="outline" className="border-zinc-700 text-[10px] text-zinc-400">
                    {showSqlGuide ? 'Thu gọn' : 'Xem SQL'}
                  </Badge>
                </button>

                {showSqlGuide && (
                  <div className="p-3 border-t border-zinc-800 space-y-2 bg-zinc-950/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">
                        Chạy trong: Supabase Dashboard → <strong>SQL Editor</strong> → New Query
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleCopySql}
                        className="h-7 text-[11px] gap-1 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Đã sao chép!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Sao chép SQL</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="max-h-48 overflow-y-auto rounded-lg bg-zinc-900 p-2.5 font-mono text-[10px] text-emerald-300 border border-zinc-800 leading-relaxed select-all">
                      {SQL_SCHEMA_SNIPPET}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB: LOGIN / REGISTER TABS */
            <div>
              {/* Tab switch */}
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1 mb-5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMessage(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                    tab === 'login'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Đăng Nhập</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrorMessage(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                    tab === 'register'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Đăng Ký Tài Khoản</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {tab === 'register' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-username" className="text-xs text-zinc-300">
                      Tên hiển thị / Nickname
                    </Label>
                    <Input
                      id="auth-username"
                      type="text"
                      placeholder="e.g. BeatMaster_2026"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="border-zinc-800 bg-zinc-900/80 focus-visible:ring-emerald-500 text-xs"
                      required={tab === 'register'}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="auth-email" className="text-xs text-zinc-300">
                    Email
                  </Label>
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="drummer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-zinc-800 bg-zinc-900/80 focus-visible:ring-emerald-500 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password" className="text-xs text-zinc-300">
                      Mật khẩu
                    </Label>
                    {tab === 'register' && (
                      <span className="text-[10px] text-zinc-500">Tối thiểu 6 ký tự</span>
                    )}
                  </div>
                  <Input
                    id="auth-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-zinc-800 bg-zinc-900/80 focus-visible:ring-emerald-500 text-xs"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 transition-all cursor-pointer"
                >
                  {submitting
                    ? 'Đang xử lý...'
                    : tab === 'login'
                    ? 'Đăng Nhập'
                    : 'Tạo Tài Khoản Trên Supabase'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <span className="text-[11px] text-zinc-500">
                  {tab === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
                  <button
                    type="button"
                    onClick={() => {
                      setTab(tab === 'login' ? 'register' : 'login');
                      setErrorMessage(null);
                    }}
                    className="text-emerald-400 font-semibold hover:underline"
                  >
                    {tab === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
