import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { authAdapter, generateDefaultAvatar } from '../services/storage';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (email: string, username: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  updateScore: (addedScore: number) => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const current = await authAdapter.getCurrentUser();
        if (current) {
          setUser(current);
        } else {
          // Initialize a friendly default guest user so the player immediately has level/stats
          const guest: UserProfile = {
            id: 'guest-player',
            email: 'guest@virtualdrum.pro',
            username: 'Drummer Pro',
            avatarUrl: generateDefaultAvatar('Drummer Pro'),
            level: 1,
            totalScore: 0,
            createdAt: Date.now(),
          };
          setUser(guest);
        }
      } catch (err) {
        console.warn('Failed to load user state:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedIn = await authAdapter.login(email, password);
      setUser(loggedIn);
      closeAuthModal();
      return loggedIn;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, username: string, password: string) => {
    setIsLoading(true);
    try {
      const registered = await authAdapter.register(email, username, password);
      setUser(registered);
      closeAuthModal();
      return registered;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authAdapter.logout();
    const guest: UserProfile = {
      id: 'guest-player',
      email: 'guest@virtualdrum.pro',
      username: 'Guest Drummer',
      avatarUrl: generateDefaultAvatar('Guest Drummer'),
      level: 1,
      totalScore: 0,
      createdAt: Date.now(),
    };
    setUser(guest);
  };

  const updateScore = async (addedScore: number): Promise<UserProfile | null> => {
    if (!user) return null;
    try {
      const updated = await authAdapter.updateUserStats(user.id, addedScore);
      setUser(updated);
      return updated;
    } catch {
      // In guest mode fallback
      const updated: UserProfile = {
        ...user,
        totalScore: user.totalScore + addedScore,
        level: Math.floor(Math.sqrt((user.totalScore + addedScore) / 500)) + 1,
      };
      setUser(updated);
      return updated;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && user.id !== 'guest-player',
        isLoading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
        updateScore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
