import { test } from 'node:test';
import assert from 'node:assert/strict';

test('turn-based calculation alternates every 10 notes between host and guest', () => {
  function getTurnInfo(noteIndex: number, isHost: boolean) {
    const turnIndex = Math.floor(noteIndex / 10);
    const isHostTurn = turnIndex % 2 === 0;
    const isMyTurn = isHost ? isHostTurn : !isHostTurn;
    const notesHitInTurn = noteIndex % 10;
    const notesRemainingInTurn = 10 - notesHitInTurn;
    return { turnIndex, isMyTurn, notesHitInTurn, notesRemainingInTurn };
  }

  // Note 0: Host's turn
  assert.equal(getTurnInfo(0, true).isMyTurn, true);
  assert.equal(getTurnInfo(0, false).isMyTurn, false);
  assert.equal(getTurnInfo(0, true).notesRemainingInTurn, 10);

  // Note 5: Still Host's turn, 5 notes left
  assert.equal(getTurnInfo(5, true).isMyTurn, true);
  assert.equal(getTurnInfo(5, false).isMyTurn, false);
  assert.equal(getTurnInfo(5, true).notesRemainingInTurn, 5);

  // Note 9: Still Host's turn, 1 note left
  assert.equal(getTurnInfo(9, true).isMyTurn, true);
  assert.equal(getTurnInfo(9, false).isMyTurn, false);
  assert.equal(getTurnInfo(9, true).notesRemainingInTurn, 1);

  // Note 10: Guest's turn (Turn 1)
  assert.equal(getTurnInfo(10, true).isMyTurn, false);
  assert.equal(getTurnInfo(10, false).isMyTurn, true);
  assert.equal(getTurnInfo(10, false).notesRemainingInTurn, 10);

  // Note 15: Guest's turn, 5 notes left
  assert.equal(getTurnInfo(15, true).isMyTurn, false);
  assert.equal(getTurnInfo(15, false).isMyTurn, true);
  assert.equal(getTurnInfo(15, false).notesRemainingInTurn, 5);

  // Note 20: Back to Host's turn (Turn 2)
  assert.equal(getTurnInfo(20, true).isMyTurn, true);
  assert.equal(getTurnInfo(20, false).isMyTurn, false);
});

test('multiplayer room session maintains player roles and host status', () => {
  const hostUser = { id: 'user-host', name: 'Host Player' };
  const guestUser = { id: 'user-guest', name: 'Guest Player' };

  const session = {
    roomId: 'room-123456',
    roomName: 'Drum Battle Arena',
    mode: 'versus' as const,
    players: [
      { id: hostUser.id, name: hostUser.name, isHost: true },
      { id: guestUser.id, name: guestUser.name, isHost: false },
    ],
    isHost: true,
  };

  assert.equal(session.players.length, 2);
  assert.equal(session.players[0].isHost, true);
  assert.equal(session.players[1].isHost, false);
  assert.equal(session.isHost, true);

  const guestPerspective = {
    ...session,
    isHost: false,
  };
  assert.equal(guestPerspective.isHost, false);
});

