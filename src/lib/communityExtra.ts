import { supabase, isSupabaseConfigured } from "./supabase";

export type RsvpStatus = "going" | "maybe" | "cant_go";

export interface CommunityEvent {
  id: string;
  community_id: string;
  created_by: string | null;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  emoji: string;
  created_at: string;
  rsvp_counts: Record<RsvpStatus, number>;
  my_rsvp: RsvpStatus | null;
}

export interface CommunityResource {
  id: string;
  community_id: string;
  uploaded_by: string | null;
  title: string;
  description: string;
  url: string | null;
  file_url: string | null;
  kind: "link" | "file";
  created_at: string;
}

async function currentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

/** Membership role for the signed-in user ('owner' | 'admin' | 'member' | null). */
export async function fetchMyMembership(communityId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  const { data } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", uid)
    .maybeSingle();
  return data?.role ?? null;
}

/** Events for a community with RSVP counts and the current user's RSVP. */
export async function fetchCommunityEvents(communityId: string): Promise<CommunityEvent[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const uid = await currentUserId();
    const { data: events, error } = await supabase
      .from("community_events")
      .select("id, community_id, created_by, title, description, starts_at, ends_at, location, emoji, created_at")
      .eq("community_id", communityId)
      .order("starts_at", { ascending: true });
    if (error || !events?.length) return [];

    const ids = events.map((e: any) => e.id);
    const [rsvpsRes, mineRes] = await Promise.all([
      supabase.from("community_event_rsvps").select("event_id, status").in("event_id", ids),
      uid
        ? supabase.from("community_event_rsvps").select("event_id, status").in("event_id", ids).eq("user_id", uid)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const counts = new Map<string, Record<RsvpStatus, number>>();
    for (const r of rsvpsRes.data ?? []) {
      const m = counts.get(r.event_id) ?? { going: 0, maybe: 0, cant_go: 0 };
      m[r.status as RsvpStatus] += 1;
      counts.set(r.event_id, m);
    }
    const mine = new Map<string, RsvpStatus>();
    for (const r of mineRes.data ?? []) mine.set(r.event_id, r.status as RsvpStatus);

    return events.map((e: any) => ({
      ...e,
      rsvp_counts: counts.get(e.id) ?? { going: 0, maybe: 0, cant_go: 0 },
      my_rsvp: mine.get(e.id) ?? null,
    }));
  } catch {
    return [];
  }
}

export async function createCommunityEvent(
  communityId: string,
  event: {
    title: string;
    description?: string;
    starts_at: string;
    ends_at?: string | null;
    location?: string;
    emoji?: string;
  },
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const uid = await currentUserId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from("community_events")
      .insert({
        community_id: communityId,
        created_by: uid,
        title: event.title.trim(),
        description: event.description?.trim() ?? "",
        starts_at: event.starts_at,
        ends_at: event.ends_at || null,
        location: event.location?.trim() ?? "",
        emoji: event.emoji?.trim() || "📅",
      })
      .select("id")
      .single();
    return error ? null : data.id;
  } catch {
    return null;
  }
}

export async function updateCommunityEvent(
  eventId: string,
  fields: Partial<Pick<CommunityEvent, "title" | "description" | "starts_at" | "ends_at" | "location" | "emoji">>,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("community_events").update(fields).eq("id", eventId);
  } catch { /* RLS will reject if not admin */ }
}

export async function deleteCommunityEvent(eventId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("community_events").delete().eq("id", eventId);
  } catch { /* ignore */ }
}

/** RSVP to an event; pass status === my current status (or null) to toggle off. */
export async function rsvpEvent(eventId: string, status: RsvpStatus | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const uid = await currentUserId();
    if (!uid) return;
    if (status == null) {
      await supabase.from("community_event_rsvps").delete().eq("event_id", eventId).eq("user_id", uid);
      return;
    }
    await supabase
      .from("community_event_rsvps")
      .upsert({ event_id: eventId, user_id: uid, status }, { onConflict: "event_id,user_id" });
  } catch { /* ignore */ }
}

export async function fetchCommunityResources(communityId: string): Promise<CommunityResource[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from("community_resources")
      .select("id, community_id, uploaded_by, title, description, url, file_url, kind, created_at")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false });
    return error ? [] : (data ?? []) as CommunityResource[];
  } catch {
    return [];
  }
}

export async function addCommunityResource(
  communityId: string,
  resource: { title: string; description?: string; kind?: "link" | "file"; url?: string; file_url?: string },
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const uid = await currentUserId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from("community_resources")
      .insert({
        community_id: communityId,
        uploaded_by: uid,
        title: resource.title.trim(),
        description: resource.description?.trim() ?? "",
        kind: resource.kind ?? (resource.file_url ? "file" : "link"),
        url: resource.url?.trim() || null,
        file_url: resource.file_url ?? null,
      })
      .select("id")
      .single();
    return error ? null : data.id;
  } catch {
    return null;
  }
}

export async function deleteCommunityResource(resourceId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("community_resources").delete().eq("id", resourceId);
  } catch { /* ignore */ }
}
