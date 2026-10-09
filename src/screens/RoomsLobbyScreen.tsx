import React, { useState, useEffect } from 'react';
import { LiveRoom, ScreenType } from '../types';
import { roomService } from '../services/roomService';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Radio,
  Plus,
  Search,
  Lock,
  Unlock,
  Sparkles,
  ArrowRight,
  Music,
  Shield,
  Volume2,
  Headphones,
  MonitorUp,
  MessageSquare,
  Mic,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RoomsLobbyScreenProps {
  onNavigate: (screen: ScreenType) => void;
  onJoinRoom: (roomId: string) => void;
}

const GENRES = ['All', 'Rock', 'Acoustic', 'Electronic', 'Jazz', 'Pop', 'Free Jam'];

export const RoomsLobbyScreen: React.FC<RoomsLobbyScreenProps> = ({
  onNavigate,
  onJoinRoom,
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [rooms, setRooms] = useState<LiveRoom[]>(() => roomService.getRooms());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Create room modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomGenre, setNewRoomGenre] = useState('Rock');
  const [newRoomMaxMembers, setNewRoomMaxMembers] = useState('8');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch from server and sync
    roomService.fetchRoomsFromServer().then((remoteRooms) => {
      setRooms(remoteRooms);
    });
    roomService.requestSync();

    const unsub = roomService.subscribeRooms((updatedRooms) => {
      setRooms(updatedRooms);
    });

    // Auto sync periodically so rooms created on other browsers appear with zero delay
    const syncInterval = setInterval(() => {
      roomService.fetchRoomsFromServer();
      roomService.requestSync();
    }, 4000);

    // Instant sync when switching back to this browser window / tab
    const handleFocus = () => {
      roomService.fetchRoomsFromServer();
      roomService.requestSync();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsub();
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleRefresh = async () => {
    setIsSyncing(true);
    const updated = await roomService.fetchRoomsFromServer();
    setRooms(updated);
    roomService.requestSync();
    setTimeout(() => {
      setIsSyncing(false);
    }, 400);
  };

  const handleClearAllRooms = async () => {
    if (!window.confirm('Are you sure you want to clear all active rooms to reset test data?')) {
      return;
    }
    setIsClearing(true);
    await roomService.clearAllRooms();
    setRooms([]);
    setTimeout(() => {
      setIsClearing(false);
    }, 400);
  };

  const handleDeleteRoom = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    await roomService.deleteRoom(roomId);
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  const handleOpenCreateModal = () => {
    if (!isAuthenticated || !user) {
      openAuthModal();
      return;
    }
    setNewRoomName(`${user.username}'s Drum Jam Room`);
    setNewRoomGenre('Rock');
    setNewRoomMaxMembers('8');
    setNewRoomDesc('Rhythm practice room: turn on mic, chat, and share your screen!');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }
    if (!newRoomName.trim()) {
      setCreateError('Please enter a room name.');
      return;
    }

    const max = parseInt(newRoomMaxMembers, 10) || 8;
    const created = roomService.createRoom(
      user,
      newRoomName.trim(),
      newRoomGenre,
      max,
      newRoomDesc.trim()
    );

    setIsCreateOpen(false);
    onJoinRoom(created.id);
  };

  const handleJoinClick = (room: LiveRoom) => {
    if (!isAuthenticated || !user) {
      openAuthModal();
      return;
    }
    if (room.isLocked) {
      alert('This room is currently locked by the host.');
      return;
    }
    if (room.members.length >= room.maxMembers && !room.members.some((m) => m.id === user.id)) {
      alert('The room has reached maximum capacity.');
      return;
    }

    const res = roomService.joinRoom(room.id, user);
    if (res.success) {
      onJoinRoom(room.id);
    } else {
      alert(res.error || 'Unable to join the room.');
    }
  };

  const safeRooms = Array.isArray(rooms) ? rooms.filter(Boolean) : [];
  const filteredRooms = safeRooms.filter((room) => {
    if (!room || typeof room !== 'object') return false;
    const name = String(room.name || '').toLowerCase();
    const ownerName = String(room.ownerName || '').toLowerCase();
    const desc = String(room.description || '').toLowerCase();
    const genre = String(room.genre || 'All').toLowerCase();
    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !query ||
      name.includes(query) ||
      ownerName.includes(query) ||
      desc.includes(query);

    const matchesGenre =
      selectedGenre === 'All' ||
      genre === selectedGenre.toLowerCase();

    return matchesSearch && matchesGenre;
  });

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full animate-fade-in">
      {/* Hero Header */}
      <div className="relative rounded-3xl border border-zinc-800 bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-zinc-950 p-6 sm:p-8 mb-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>Realtime Multiplayer Rooms</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Live Rooms 🥁
            </h1>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Create jam rooms, turn on <strong>Voice Mic</strong>, chat in <strong>Live Chat</strong>, share your{' '}
              <strong>Screen</strong>, and jam on virtual drums together in browser real-time!
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1 rounded-md bg-zinc-800/80 px-2.5 py-1 border border-zinc-700/60 text-zinc-300">
                <Mic className="h-3 w-3 text-rose-400" /> Voice Chat
              </span>
              <span className="flex items-center gap-1 rounded-md bg-zinc-800/80 px-2.5 py-1 border border-zinc-700/60 text-zinc-300">
                <MonitorUp className="h-3 w-3 text-emerald-400" /> Screen Sharing
              </span>
              <span className="flex items-center gap-1 rounded-md bg-zinc-800/80 px-2.5 py-1 border border-zinc-700/60 text-zinc-300">
                <MessageSquare className="h-3 w-3 text-amber-400" /> Live Chat
              </span>
              <span className="flex items-center gap-1 rounded-md bg-zinc-800/80 px-2.5 py-1 border border-zinc-700/60 text-zinc-300">
                <Shield className="h-3 w-3 text-blue-400" /> Host Controls
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-3 shrink-0">
            <Button
              id="lobby-create-room-btn"
              type="button"
              size="lg"
              onClick={handleOpenCreateModal}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-rose-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-5 w-5" />
              <span>Create New Room</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Guest Notice if unauthenticated */}
      {(!isAuthenticated || !user) && (
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              You are currently browsing as <strong>Guest</strong>. Please sign in to create your own room or join other drummers!
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={openAuthModal}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shrink-0 px-4 py-1.5 cursor-pointer"
          >
            Sign In Now
          </Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        {/* Genre Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => setSelectedGenre(genre)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedGenre === genre
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* Search Input & Refresh Button */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[240px] md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              id="lobby-search-input"
              type="text"
              placeholder="Search by room name, host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl border-zinc-800 bg-zinc-900/90 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-rose-500"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            title="Refresh realtime room list"
            className="rounded-xl border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs px-3 py-2 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-rose-400' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            id="clear-all-rooms-btn"
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearAllRooms}
            disabled={isClearing}
            title="Clear all rooms (Reset for testing)"
            className="rounded-xl border-zinc-800 bg-zinc-900/90 hover:bg-rose-950/40 hover:border-rose-900/50 text-zinc-400 hover:text-rose-400 text-xs px-3 py-2 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Trash2 className={`h-3.5 w-3.5 ${isClearing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Clear All</span>
          </Button>
        </div>
      </div>

      {/* Rooms Grid */}
      {filteredRooms.length === 0 ? (
        <Card className="rounded-3xl border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-400">
          <Headphones className="h-12 w-12 mx-auto mb-3 text-zinc-600 animate-pulse" />
          <h3 className="text-base font-bold text-white mb-1">No rooms found in this category</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-6">
            Be the first to create a jam room, invite friends, voice chat, and jam on drums together!
          </p>
          <Button
            type="button"
            onClick={handleOpenCreateModal}
            className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-5 py-2.5 cursor-pointer"
          >
            Create Room Now
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room) => {
            const members = Array.isArray(room.members) ? room.members.filter(Boolean) : [];
            const maxMembers = Number(room.maxMembers) || 8;
            const isFull = members.length >= maxMembers;
            const isUserInRoom = Boolean(user && members.some((m) => m && m.id === user.id));
            const isUserOwner = Boolean(user && room.ownerId === user.id);
            const roomName = room.name || 'Jam Room';
            const roomGenre = room.genre || 'All';
            const roomDesc = room.description || 'Live music jam and drum performance room.';
            const ownerAvatar = room.ownerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${room.ownerName || 'Host'}`;
            const ownerName = room.ownerName || 'Host';

            return (
              <Card
                key={room.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/90 hover:border-zinc-700 transition-all duration-200 overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-rose-950/20"
              >
                {/* Header card */}
                <div className="p-5 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-rose-500/10 border-rose-500/30 text-rose-400 text-[10px] font-mono uppercase">
                        {roomGenre}
                      </Badge>
                      {room.activeScreenShareUser && (
                        <Badge className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-[10px] flex items-center gap-1 font-mono">
                          <MonitorUp className="h-2.5 w-2.5" />
                          <span>Screen Live</span>
                        </Badge>
                      )}
                      {room.isLocked && (
                        <Badge className="bg-amber-500/10 border-amber-500/30 text-amber-400 text-[10px] flex items-center gap-1 font-mono">
                          <Lock className="h-2.5 w-2.5" />
                          <span>Locked</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-zinc-300 font-bold">
                        {members.length}/{maxMembers}
                      </span>
                      <Users className="h-3.5 w-3.5 text-zinc-500" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-rose-300 transition-colors line-clamp-1 mb-1">
                    {roomName}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-2 min-h-[32px] leading-relaxed">
                    {roomDesc}
                  </p>
                </div>

                {/* Host Info & Action Footer */}
                <div className="p-5 pt-3 border-t border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between gap-3">
                  {/* Host info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={ownerAvatar}
                      alt={ownerName}
                      className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-700 p-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-200 truncate">
                        <span>{ownerName}</span>
                        {isUserOwner && (
                          <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                        <Shield className="h-2.5 w-2.5 text-amber-400" /> Host
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Delete room button (for room owner or host-system) */}
                    {(isUserOwner || room.ownerId === 'host-system') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteRoom(e, room.id)}
                        title="Delete room"
                        className="h-8 w-8 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Join Button */}
                    <Button
                      id={`join-room-btn-${room.id}`}
                      type="button"
                      size="sm"
                      onClick={() => handleJoinClick(room)}
                      disabled={isFull && !isUserInRoom}
                      className={`rounded-xl text-xs font-bold px-4 py-2 shrink-0 transition-all cursor-pointer ${
                        isUserInRoom
                          ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20'
                          : isFull
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          : 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 group-hover:translate-x-0.5'
                      }`}
                    >
                      <span>{isUserInRoom ? 'Continue' : isFull ? 'Full' : 'Join'}</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          id="create-room-modal"
          className="max-w-md gap-0 border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl overflow-hidden"
        >
          <DialogHeader className="border-b border-zinc-800 px-6 py-4 bg-gradient-to-r from-zinc-900 to-zinc-950">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/20">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">
                  Create New Live Room
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  You will be the Host of this room with full moderation controls
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateRoomSubmit} className="p-6 space-y-4">
            {createError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="room-name" className="text-xs text-zinc-300">
                Room Name *
              </Label>
              <Input
                id="room-name"
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g. Rock Jam Session Night 🎸"
                className="border-zinc-800 bg-zinc-900 text-xs focus-visible:ring-rose-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="room-genre" className="text-xs text-zinc-300">
                  Genre
                </Label>
                <select
                  id="room-genre"
                  value={newRoomGenre}
                  onChange={(e) => setNewRoomGenre(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                >
                  <option value="Rock">Rock</option>
                  <option value="Acoustic">Acoustic</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Jazz">Jazz</option>
                  <option value="Pop">Pop</option>
                  <option value="Free Jam">Free Jam</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="room-max-members" className="text-xs text-zinc-300">
                  Max Capacity
                </Label>
                <select
                  id="room-max-members"
                  value={newRoomMaxMembers}
                  onChange={(e) => setNewRoomMaxMembers(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                >
                  <option value="2">2 Members (Duo)</option>
                  <option value="4">4 Members (Band)</option>
                  <option value="8">8 Members (Standard)</option>
                  <option value="16">16 Members (Community)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="room-desc" className="text-xs text-zinc-300">
                Room Description (Optional)
              </Label>
              <Input
                id="room-desc"
                type="text"
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder="e.g. Practicing beats, sharing tips, and having fun..."
                className="border-zinc-800 bg-zinc-900 text-xs focus-visible:ring-rose-500"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                id="submit-create-room-btn"
                type="submit"
                className="rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-xs font-bold text-white shadow-lg shadow-rose-500/25 hover:from-rose-600 hover:to-amber-600 cursor-pointer"
              >
                Create & Enter Room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
