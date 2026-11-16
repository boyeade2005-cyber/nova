import { supabase, isSupabaseConfigured } from "./supabase";

const PARTY_COLS = "id, username, display_name, avatar_emoji, avatar_color, is_verified";
const OFFER_COLS = `*, buyer:profiles(${PARTY_COLS})`;
const ORDER_COLS = `*, product:products(id, title, price, emoji, gradient, images), buyer:profiles(${PARTY_COLS}), seller:profiles(${PARTY_COLS})`;

async function sessionUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

// ---------- product images (media bucket, same pattern as uploadMedia) ----------

export async function uploadProductImage(file: File): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await sessionUserId();
  if (!userId) return null;
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/products/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file);
  if (error) return null;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// ---------- listings ----------

export async function createProductWithImages(p: {
  title: string; description?: string; price: number; category?: string;
  condition?: string; location?: string; emoji?: string; imageUrls?: string[];
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await sessionUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("products")
    .insert({
      seller_id: userId,
      title: p.title,
      description: p.description ?? "",
      price: p.price,
      category: p.category ?? "general",
      condition: p.condition ?? "Good",
      location: p.location ?? "Global",
      emoji: p.emoji ?? "📦",
      gradient: "linear-gradient(135deg,#FF6B00,#FF2A5F)",
      images: p.imageUrls?.length ? p.imageUrls : [],
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

// ---------- favorites ----------

export async function fetchProductFavorites(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const userId = await sessionUserId();
  if (!userId) return new Set();
  const { data } = await supabase
    .from("product_favorites")
    .select("product_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r: any) => r.product_id as string));
}

export async function toggleProductFavorite(productId: string, fav: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = await sessionUserId();
  if (!userId) return;
  if (fav) {
    await supabase.from("product_favorites").upsert(
      { user_id: userId, product_id: productId },
      { onConflict: "user_id,product_id", ignoreDuplicates: true },
    );
  } else {
    await supabase.from("product_favorites").delete()
      .eq("user_id", userId).eq("product_id", productId);
  }
}

// ---------- offers ----------

export async function fetchProductOffers(productId: string): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("product_offers")
    .select(OFFER_COLS)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createOffer(productId: string, amount: number, message?: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await sessionUserId();
  if (!userId || !(amount > 0)) return null;
  const { data, error } = await supabase
    .from("product_offers")
    .insert({ product_id: productId, buyer_id: userId, amount, message: message?.trim() || null })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

export async function respondToOffer(offerId: string, accept: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  const { error } = await supabase.rpc("respond_to_offer", { p_offer: offerId, p_accept: accept });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------- orders / escrow ----------

export async function placeOrder(productId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  const { data: product } = await supabase
    .from("products").select("price").eq("id", productId).maybeSingle();
  if (!product) return { ok: false, error: "product_unavailable" };
  const { error } = await supabase.rpc("place_order", {
    p_product: productId,
    p_amount: Number(product.price),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function fetchMyOrders(role: "buying" | "selling"): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const userId = await sessionUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from("orders")
    .select(ORDER_COLS)
    .eq(role === "buying" ? "buyer_id" : "seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function completeOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  const { error } = await supabase.rpc("complete_order", { p_order: orderId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cancelOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  const { error } = await supabase.rpc("cancel_order", { p_order: orderId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
