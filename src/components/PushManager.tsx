import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export const ENABLE_PUSH_EVENT = "nova:enable-push";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function enablePush(): Promise<void> {
  if (!isSupabaseConfigured || !VAPID_PUBLIC_KEY) return;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const json = subscription.toJSON();
  await supabase.from("push_subscriptions").upsert(
    {
      user_id: session.user.id,
      endpoint: subscription.endpoint,
      keys: json.keys ?? {},
    },
    { onConflict: "endpoint" },
  );
}

/**
 * Headless push opt-in manager. Never prompts on mount — dispatch
 * `new Event("nova:enable-push")` on window to trigger the permission flow.
 */
export default function PushManager(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    const onEnable = () => {
      void enablePush().catch(() => {
        // push is best-effort; failures are silent
      });
    };

    window.addEventListener(ENABLE_PUSH_EVENT, onEnable);
    return () => window.removeEventListener(ENABLE_PUSH_EVENT, onEnable);
  }, []);

  return null;
}
