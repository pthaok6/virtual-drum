import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isConfigured: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const LOCAL_DEMO_USER_KEY = 'virtual-drum-demo-user';

function getLocalDemoUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_DEMO_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => getLocalDemoUser());
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (!isMounted) return;
      if (sessionError) {
        console.warn('Supabase getSession error:', sessionError.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const u = session.user;
        const name = (u.user_metadata?.display_name as string) || (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'User';
        setProfile({
          id: u.id,
          email: u.email || '',
          displayName: name,
          avatarUrl: u.user_metadata?.avatar_url as string | undefined,
        });
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        const u = currentSession.user;
        const name = (u.user_metadata?.display_name as string) || (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'User';
        setProfile({
          id: u.id,
          email: u.email || '',
          displayName: name,
          avatarUrl: u.user_metadata?.avatar_url as string | undefined,
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    setError(null);
    if (!isSupabaseConfigured || !supabase) {
      // Local fallback demo login
      const demoProfile: UserProfile = {
        id: 'you',
        email,
        displayName: email.split('@')[0] || 'You',
      };
      setProfile(demoProfile);
      localStorage.setItem(LOCAL_DEMO_USER_KEY, JSON.stringify(demoProfile));
      return { error: null };
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return { error: new Error(signInError.message) };
      }

      if (data.user) {
        const name = (data.user.user_metadata?.display_name as string) || data.user.email?.split('@')[0] || 'User';
        setProfile({
          id: data.user.id,
          email: data.user.email || '',
          displayName: name,
        });
      }
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return { error: new Error(message) };
    }
  };

  const signUp = async (email: string, password: string, displayName: string): Promise<{ error: Error | null; needsEmailConfirmation?: boolean }> => {
    setError(null);
    if (!isSupabaseConfigured || !supabase) {
      // Local fallback demo register
      const demoProfile: UserProfile = {
        id: 'you',
        email,
        displayName: displayName || email.split('@')[0] || 'You',
      };
      setProfile(demoProfile);
      localStorage.setItem(LOCAL_DEMO_USER_KEY, JSON.stringify(demoProfile));
      return { error: null };
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return { error: new Error(signUpError.message) };
      }

      const needsEmailConfirmation = !data.session && Boolean(data.user);
      if (data.user && data.session) {
        setProfile({
          id: data.user.id,
          email: data.user.email || '',
          displayName: displayName || data.user.email?.split('@')[0] || 'User',
        });
      }
      return { error: null, needsEmailConfirmation };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      return { error: new Error(message) };
    }
  };

  const signOut = async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    try {
      localStorage.removeItem(LOCAL_DEMO_USER_KEY);
    } catch {}
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isConfigured: isSupabaseConfigured,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

