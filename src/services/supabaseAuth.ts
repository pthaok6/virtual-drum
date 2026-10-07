import { IAuthAdapter, UserProfile } from '../types';
import { getSupabaseClient } from './supabase';
import { calculateUserLevel, generateDefaultAvatar } from './authUtils';

export class SupabaseAuthAdapter implements IAuthAdapter {
  public async getCurrentUser(): Promise<UserProfile | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return null;
      }

      // Try reading user profile from public.profiles table
      let profileData: any = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && data) {
          profileData = data;
        }
      } catch (err) {
        console.warn('Could not query profiles table, falling back to auth metadata:', err);
      }

      const meta = user.user_metadata || {};
      const fallbackName =
        meta.username ||
        (user.email ? user.email.split('@')[0] : 'Drummer');
      const username = profileData?.username || fallbackName;
      const avatarUrl =
        profileData?.avatar_url ||
        meta.avatar_url ||
        generateDefaultAvatar(username);
      const totalScore = Number(profileData?.total_score ?? meta.total_score ?? 0);
      const level = Number(
        profileData?.level ?? meta.level ?? calculateUserLevel(totalScore)
      );
      const createdAt = profileData?.created_at
        ? new Date(profileData.created_at).getTime()
        : new Date(user.created_at).getTime();

      // If user profile is not in profiles table yet, try to upsert it
      if (!profileData) {
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            username,
            avatar_url: avatarUrl,
            level,
            total_score: totalScore,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // Table might not exist yet, ignore
        }
      }

      return {
        id: user.id,
        email: user.email || '',
        username,
        avatarUrl,
        level,
        totalScore,
        createdAt,
      };
    } catch (err) {
      console.warn('Failed to get Supabase current user:', err);
      return null;
    }
  }

  public async login(email: string, password: string): Promise<UserProfile> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase is not configured. Please check your Supabase URL and Anon Key.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Incorrect email or password.');
      }
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Email has not been confirmed. Please check your inbox or disable Email Confirmation in Supabase Auth Settings.');
      }
      throw new Error(`Sign in failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('User information was not returned by Supabase.');
    }

    const profile = await this.getCurrentUser();
    if (profile) return profile;

    // Fallback if profile fetch fails
    const meta = data.user.user_metadata || {};
    const fallbackUsername = meta.username || email.split('@')[0] || 'Drummer';
    return {
      id: data.user.id,
      email: data.user.email || email,
      username: fallbackUsername,
      avatarUrl: meta.avatar_url || generateDefaultAvatar(fallbackUsername),
      level: Number(meta.level) || 1,
      totalScore: Number(meta.total_score) || 0,
      createdAt: new Date(data.user.created_at).getTime(),
    };
  }

  public async register(
    email: string,
    username: string,
    password: string
  ): Promise<UserProfile> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase is not configured. Please configure your URL and Anon Key.');
    }

    const cleanUsername = username.trim() || email.split('@')[0] || 'Drummer';
    const avatarUrl = generateDefaultAvatar(cleanUsername);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: cleanUsername,
          avatar_url: avatarUrl,
          level: 1,
          total_score: 0,
        },
      },
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        throw new Error('This email is already registered. Please switch to Sign In.');
      }
      if (error.message.includes('Password should be')) {
        throw new Error('Password is too short or does not meet security requirements.');
      }
      throw new Error(`Registration failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Unable to create user on Supabase.');
    }

    // Try to insert directly into public.profiles table
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email || email,
        username: cleanUsername,
        avatar_url: avatarUrl,
        level: 1,
        total_score: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (insertErr) {
      console.warn('Could not insert to profiles table directly (may be handled by trigger):', insertErr);
    }

    // Notice if email confirmation is required
    const isConfirmationRequired = !data.session && (!data.user.identities || data.user.identities.length > 0);
    if (isConfirmationRequired && !data.session) {
      console.info('Supabase email confirmation might be enabled.');
    }

    return {
      id: data.user.id,
      email: data.user.email || email,
      username: cleanUsername,
      avatarUrl,
      level: 1,
      totalScore: 0,
      createdAt: new Date(data.user.created_at).getTime(),
    };
  }

  public async logout(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  public async updateUserStats(
    userId: string,
    addedScore: number
  ): Promise<UserProfile> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const currentProfile = await this.getCurrentUser();
    const currentScore = currentProfile ? currentProfile.totalScore : 0;
    const newTotalScore = currentScore + addedScore;
    const newLevel = calculateUserLevel(newTotalScore);

    // 1. Update public.profiles table
    try {
      await supabase
        .from('profiles')
        .update({
          total_score: newTotalScore,
          level: newLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch (tableErr) {
      console.warn('Could not update profiles table:', tableErr);
    }

    // 2. Also sync to user_metadata
    try {
      await supabase.auth.updateUser({
        data: {
          total_score: newTotalScore,
          level: newLevel,
        },
      });
    } catch (metaErr) {
      console.warn('Could not update auth metadata:', metaErr);
    }

    return {
      id: userId,
      email: currentProfile?.email || '',
      username: currentProfile?.username || 'Drummer',
      avatarUrl: currentProfile?.avatarUrl || generateDefaultAvatar('Drummer'),
      level: newLevel,
      totalScore: newTotalScore,
      createdAt: currentProfile?.createdAt || Date.now(),
    };
  }
}
