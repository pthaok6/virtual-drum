import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USERS } from '../src/data/community';
import { searchUsers, createComment, createMessage, conversationMessages, postPath, postUrl, DEMO_MESSAGES, removeOwnComment } from '../src/services/community';

test('user search matches names and handles without case or accent sensitivity', () => {
  assert.equal(searchUsers(USERS, 'MAI')[0].id, 'mai-beats');
  assert.equal(searchUsers(USERS, '@linh.groove')[0].id, 'linh-groove');
  assert.equal(searchUsers(USERS, 'mai beats').length, 1);
  assert.equal(searchUsers(USERS, 'missing').length, 0);
  assert.equal(searchUsers(USERS, ' ').length, USERS.length);
  const user = { ...USERS[0], name: 'Đặng Thảo', handle: '@thao' };
  assert.equal(searchUsers([user], 'dang thao').length, 1);
});

test('comments and messages trim content, retain authored text, and reject empty or oversized submissions', () => {
  const comment = createComment('demo-you', '  Rất hay!  ');
  assert.equal(comment.body, 'Rất hay!'); assert.equal(comment.userId, 'you'); assert.equal(comment.clipId, 'demo-you');
  assert.ok(comment.id); assert.ok(!Number.isNaN(Date.parse(comment.createdAt)));
  assert.throws(() => createComment('demo-you', '   '));
  assert.throws(() => createComment('demo-you', 'a'.repeat(1001)));
  const message = createMessage('mai-beats', '  Hello!  ');
  assert.equal(message.body, 'Hello!'); assert.equal(message.senderId, 'you'); assert.equal(message.recipientId, 'mai-beats');
  assert.throws(() => createMessage('you', 'Hi'));
  assert.throws(() => createMessage('mai-beats', ''));
  assert.throws(() => createMessage('mai-beats', 'a'.repeat(2001)));
});

test('conversations include both directions and exclude other users', () => {
  const outgoing = { ...createMessage('mai-beats', 'Hello'), createdAt: '2026-10-08T09:00:00Z' };
  const unrelated = { ...outgoing, senderId: 'linh-groove', recipientId: 'mai-beats' };
  const items = conversationMessages([...DEMO_MESSAGES, outgoing, unrelated], 'mai-beats');
  assert.equal(items.length, 2); assert.equal(items.at(-1)?.body, 'Hello');
  assert.ok(items.every(message => message.senderId === 'you' || message.recipientId === 'you'));
});

test('post links address the dedicated post page and preserve deployment base paths', () => {
  assert.equal(postPath('local-123'), '/posts/local-123');
  assert.equal(postUrl('demo-you', 'https://drums.example'), 'https://drums.example/posts/demo-you');
  assert.equal(postUrl('demo-you', 'https://drums.example', '/drum/'), 'https://drums.example/drum/posts/demo-you');
  assert.equal(postPath('a/b'), '/posts/a%2Fb');
});

test('comment replies keep the parent relationship when saved and restored', () => {
  const parent = createComment('demo-you', 'Original comment');
  const reply = createComment('demo-you', '  My reply  ', parent.id);
  const nested = createComment('demo-you', 'Reply to the reply', reply.id);
  const restored = JSON.parse(JSON.stringify([parent, reply, nested]));
  assert.equal(restored[1].parentId, parent.id);
  assert.equal(restored[1].body, 'My reply');
  assert.equal(restored[2].parentId, reply.id);
  assert.equal(parent.parentId, undefined);
});

test('deleting your comment preserves other replies and cannot delete another user comment', () => {
  const parent = createComment('demo-you', 'Parent');
  const reply = { ...createComment('demo-you', 'Another player reply', parent.id), userId: 'mai-beats' };
  const nested = createComment('demo-you', 'Nested reply', reply.id);
  const comments = [parent, reply, nested];
  assert.equal(removeOwnComment(comments, reply.id), comments);
  const remaining = removeOwnComment(comments, parent.id);
  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].parentId, undefined);
  assert.equal(remaining[1].parentId, reply.id);
});
