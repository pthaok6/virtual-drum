import { createContext, useContext, type ReactNode } from 'react';
import { CHALLENGES } from './challenges';
import type { RhythmChallenge } from '../types';

const ChallengeLibraryContext = createContext<RhythmChallenge[]>(CHALLENGES);
export const useChallenges = () => useContext(ChallengeLibraryContext);
export function ChallengeLibraryProvider({ challenges, children }: { challenges: RhythmChallenge[]; children: ReactNode }) {
  return <ChallengeLibraryContext.Provider value={challenges}>{children}</ChallengeLibraryContext.Provider>;
}
