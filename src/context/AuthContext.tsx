import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile } from '../types';
import { authAdapter, generateDefaultAvatar } from '../services/storage';
import {
  getSupabaseConfig,
  getSupabaseClient,
  saveCustomSupabaseConfig,
  testSupabaseConnection,
  SupabaseConfigInfo,
} from '../services/supabase';

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
  // Supabase status & configuration
  isSupabaseConfigured: boolean;
  supabaseConfig: SupabaseConfigInfo;
  saveSupabaseConfig: (url: string, anonKey: string) => Promise<void>;
  testSupabase: (
    url?: string,
    anonKey?: string
  ) => Promise<{ success: boolean; message: string; tableProfilesExists: boolean }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfigInfo>(getSupabaseConfig());

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const current = await authAdapter.getCurrentUser();
      if (current && current.id && !current.id.startsWith('guest-')) {
        setUser(current);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('Failed to load user state:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial user load
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Setup Supabase auth state change listener when configured
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          const current = await authAdapter.getCurrentUser();
          if (current && current.id && !current.id.startsWith('guest-')) setUser(current);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseConfig]);

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
    setUser(null);
    closeAuthModal();
  };

  const updateScore = async (addedScore: number): Promise<UserProfile | null> => {
    if (!user || user.id.startsWith('guest-')) return null;
    try {
      const updated = await authAdapter.updateUserStats(user.id, addedScore);
      setUser(updated);
      return updated;
    } catch {
      // In offline fallback
      const updated: UserProfile = {
        ...user,
        totalScore: user.totalScore + addedScore,
        level: Math.floor(Math.sqrt((user.totalScore + addedScore) / 500)) + 1,
      };
      setUser(updated);
      return updated;
    }
  };

  const handleSaveSupabaseConfig = async (url: string, anonKey: string) => {
    saveCustomSupabaseConfig(url, anonKey);
    const updated = getSupabaseConfig();
    setSupabaseConfig(updated);
    await loadUser();
  };

  const handleTestSupabase = async (url?: string, anonKey?: string) => {
    return testSupabaseConnection(url, anonKey);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !user.id.startsWith('guest-'),
        isLoading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
        updateScore,
        isSupabaseConfigured: supabaseConfig.isConfigured,
        supabaseConfig,
        saveSupabaseConfig: handleSaveSupabaseConfig,
        testSupabase: handleTestSupabase,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isAuthModalOpen: false,
      openAuthModal: () => {},
      closeAuthModal: () => {},
      login: async () => ({ id: '', email: '', username: '', avatarUrl: '', level: 1, totalScore: 0, createdAt: 0 }),
      register: async () => ({ id: '', email: '', username: '', avatarUrl: '', level: 1, totalScore: 0, createdAt: 0 }),
      logout: async () => {},
      updateScore: async () => null,
      isSupabaseConfigured: false,
      supabaseConfig: { url: '', anonKey: '', isFromEnv: false, isConfigured: false },
      saveSupabaseConfig: async () => {},
      testSupabase: async () => ({ success: false, message: '', tableProfilesExists: false }),
      refreshUser: async () => {},
    };
  }
  return context;
}
