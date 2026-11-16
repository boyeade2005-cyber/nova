import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { Session, User as AuthUser } from "@supabase/supabase-js";
import type { User } from "../data/mock";

export interface SessionState {
  session: Session | null;
  authUser: AuthUser | null;
  profile: User | null;
  loading: boolean;
}

function mapProfile(p: any): User {
  return {
    id: p.id,
    name: p.display_name ?? p.username,
    handle: p.username,
    avatarColor: p.avatar_color ?? "#FF6B00",
    avatarEmoji: p.avatar_emoji ?? "🦊",
    bio: p.bio ?? undefined,
    location: p.location ?? undefined,
    country: p.country ?? undefined,
    region: p.region ?? undefined,
    verified: p.is_verified,
    interests: p.interests ?? [],
  };
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, authUser: null, profile: null, loading: true });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState({ session: null, authUser: null, profile: null, loading: false });
      return;
    }
    let mounted = true;

    const loadProfile = async (userId: string) => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (mounted && data) setState((s) => ({ ...s, profile: mapProfile(data) }));
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setState({ session, authUser: session?.user ?? null, profile: null, loading: false });
      if (session?.user) void loadProfile(session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((s) => ({ ...s, session, authUser: session?.user ?? null }));
      if (session?.user) void loadProfile(session.user.id);
      else setState((s) => ({ ...s, profile: null }));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
