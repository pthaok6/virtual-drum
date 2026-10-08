import { useCallback, useEffect, useState } from 'react';
import { COMMENTS_STORAGE_KEY, MESSAGES_STORAGE_KEY, DEMO_COMMENTS, DEMO_MESSAGES, CURRENT_USER_ID, createComment, createMessage, removeOwnComment, type PostComment, type DirectMessage } from '../services/community';
import { USERS } from '../data/community';

function readArray<T>(key: string, fallback: T[]): T[] {
  try { const stored = localStorage.getItem(key); if (!stored) return fallback; const data = JSON.parse(stored); return Array.isArray(data) ? data : fallback; } catch { return fallback; }
}
function useStoredList<T>(key: string, fallback: T[]) {
  const [items, setItems] = useState<T[]>(() => readArray(key, fallback));
  const [error, setError] = useState('');
  const update = useCallback((change: (previous: T[]) => T[]) => {
    setItems(previous => change(previous));
  }, [key]);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(items)); setError(''); }
    catch { setError('Changes could not be saved. Browser storage is unavailable.'); }
  }, [key, items]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key) setItems(readArray(key, fallback)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key, fallback]);
  return { items, update, error };
}
export function useCommunity() {
  const comments = useStoredList<PostComment>(COMMENTS_STORAGE_KEY, DEMO_COMMENTS);
  const messages = useStoredList<DirectMessage>(MESSAGES_STORAGE_KEY, DEMO_MESSAGES);
  const addComment = (clipId: string, body: string, parentId?: string) => {
    if (parentId && !comments.items.some(comment => comment.id === parentId && comment.clipId === clipId)) throw new Error('Comment no longer exists.');
    const comment = createComment(clipId, body, parentId);
    comments.update(previous => [...previous, comment]);
  };
  const removeComment = (id: string) => comments.update(previous => removeOwnComment(previous, id));
  const sendMessage = (recipientId: string, body: string) => {
    if (!USERS.some(user => user.id === recipientId)) throw new Error('Player not found.');
    const message = createMessage(recipientId, body);
    messages.update(previous => [...previous, message]);
  };
  const markRead = useCallback((userId: string) => {
    messages.update(previous => previous.some(message => message.senderId === userId && message.recipientId === CURRENT_USER_ID && !message.read)
      ? previous.map(message => message.senderId === userId && message.recipientId === CURRENT_USER_ID ? { ...message, read: true } : message) : previous);
  }, [messages.update]);
  return { comments: comments.items, messages: messages.items, addComment, removeComment, sendMessage, markRead, storageError: comments.error || messages.error };
}
