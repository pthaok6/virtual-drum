import type { CommunityUser } from '../data/community';

export interface PostComment { id: string; clipId: string; userId: string; body: string; createdAt: string; parentId?: string }
export interface DirectMessage { id: string; senderId: string; recipientId: string; body: string; createdAt: string; read: boolean }
export const COMMENTS_STORAGE_KEY = 'virtual-drum-comments';
export const MESSAGES_STORAGE_KEY = 'virtual-drum-messages';
export const CURRENT_USER_ID = 'you';

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
}
export function searchUsers(users: CommunityUser[], query: string): CommunityUser[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return users.filter(user => terms.every(term => normalizeSearch(user.name + ' ' + user.handle).includes(term)));
}
export function postPath(clipId: string): string { return '/posts/' + encodeURIComponent(clipId); }
export function postUrl(clipId: string, origin: string, basePath = '/'): string {
  const base = new URL(basePath, origin);
  return new URL(base.pathname.replace(/\/$/, '') + postPath(clipId), base.origin).href;
}
export function conversationMessages(messages: DirectMessage[], userId: string): DirectMessage[] {
  return messages.filter(message => message.senderId === CURRENT_USER_ID && message.recipientId === userId || message.senderId === userId && message.recipientId === CURRENT_USER_ID)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export function createComment(clipId: string, body: string, parentId?: string): PostComment {
  const text = body.trim();
  if (!text || text.length > 1000) throw new Error('Comment must contain 1–1000 characters.');
  return { id: crypto.randomUUID(), clipId, userId: CURRENT_USER_ID, body: text, createdAt: new Date().toISOString(), ...(parentId ? { parentId } : {}) };
}
export function removeOwnComment(comments: PostComment[], id: string): PostComment[] {
  const target = comments.find(comment => comment.id === id && comment.userId === CURRENT_USER_ID);
  if (!target) return comments;
  // Keep other people's replies visible when their parent is removed.
  return comments.filter(comment => comment.id !== id).map(comment =>
    comment.clipId === target.clipId && comment.parentId === id ? { ...comment, parentId: target.parentId } : comment
  );
}

export function createMessage(recipientId: string, body: string): DirectMessage {
  const text = body.trim();
  if (!text || text.length > 2000) throw new Error('Message must contain 1–2000 characters.');
  if (recipientId === CURRENT_USER_ID) throw new Error('Choose another player to message.');
  return { id: crypto.randomUUID(), senderId: CURRENT_USER_ID, recipientId, body: text, createdAt: new Date().toISOString(), read: true };
}

export const DEMO_COMMENTS: PostComment[] = [
  { id: 'comment-mai', clipId: 'demo-you', userId: 'mai-beats', body: 'Nice groove! That snare timing sounds great.', createdAt: '2026-10-07T12:00:00Z' },
  { id: 'comment-linh', clipId: 'demo-mai', userId: 'linh-groove', body: 'Love the energy in this performance!', createdAt: '2026-10-08T08:00:00Z' },
];
export const DEMO_MESSAGES: DirectMessage[] = [
  { id: 'message-mai', senderId: 'mai-beats', recipientId: 'you', body: 'Want to practice a rock challenge together?', createdAt: '2026-10-08T07:00:00Z', read: false },
  { id: 'message-linh', senderId: 'linh-groove', recipientId: 'you', body: 'Check out my latest funk performance!', createdAt: '2026-10-08T06:00:00Z', read: true },
];
