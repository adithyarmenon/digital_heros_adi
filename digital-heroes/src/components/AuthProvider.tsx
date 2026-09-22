'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Subscription } from '@/lib/domain';

type Ctx = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  subscription: Subscription | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>({
  loading: true,
  userId: null,
  profile: null,
  subscription: null,
  refresh: async () => {},
  signOut: async () => {},
});
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUserId(null);
      setProfile(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    setUserId(user.id);
    const [{ data: prof }, { data: sub }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    setProfile(prof as Profile | null);
    setSubscription(sub as Subscription | null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, [load, supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setProfile(null);
    setSubscription(null);
  };

  return (
    <AuthCtx.Provider value={{ loading, userId, profile, subscription, refresh: load, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}
