import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, SlidersHorizontal, MapPin, ShieldCheck, Heart,
  MessageCircle, Tag, Truck, RotateCcw, BadgeCheck, Plus, X, Eye,
  ImagePlus, CheckCircle2, AlertCircle, Wallet,
} from "lucide-react";
import { productCategories } from "../data/mock";
import { Avatar, VerifiedBadge } from "../components/Avatar";
import { BottomSheet } from "../components/BottomSheet";
import { fetchProducts } from "../lib/api";
import { useSession } from "../lib/useSession";
import {
  uploadProductImage, createProductWithImages, fetchProductFavorites,
  toggleProductFavorite, fetchProductOffers, createOffer, respondToOffer,
  placeOrder, fetchMyOrders, completeOrder, cancelOrder,
} from "../lib/marketplace";

const fmtPrice = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function sellerUser(p: any) {
  const s = p.seller ?? {};
  return {
    id: s.id ?? "seller",
    name: s.display_name ?? s.username ?? "Seller",
    handle: s.username ?? "seller",
    avatarColor: s.avatar_color ?? "#FF6B00",
    avatarEmoji: s.avatar_emoji ?? "🦊",
    verified: s.is_verified,
  };
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  held: { label: "Escrow held", cls: "bg-amber-500/15 text-amber-500" },
  completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-500" },
  cancelled: { label: "Cancelled", cls: "bg-surface2 text-muted" },
  refunded: { label: "Refunded", cls: "bg-surface2 text-muted" },
};

export function MarketScreen({ onMessageSeller }: { onMessageSeller?: (userId: string) => void }) {
  const { profile: me } = useSession();
  const [view, setView] = useState<"browse" | "orders">("browse");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<"relevant" | "price-asc" | "price-desc">("relevant");
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [escrowOnly, setEscrowOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [offerFor, setOfferFor] = useState<any | null>(null);
  const [buyFor, setBuyFor] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const load = () => {
    setLoading(true);
    fetchProducts(cat === "all" ? undefined : cat).then((d) => { setItems(d); setLoading(false); });
  };
  useEffect(load, [cat]);

  useEffect(() => {
    fetchProductFavorites().then(setFavorites);
  }, []);

  const toggleFav = async (p: any) => {
    const next = !favorites.has(p.id);
    setFavorites((f) => {
      const s = new Set(f);
      if (next) s.add(p.id); else s.delete(p.id);
      return s;
    });
    await toggleProductFavorite(p.id, next);
  };

  const filtered = useMemo(() => {
    let list = items.filter((p) => {
      if (query && !(`${p.title} ${p.description ?? ""} ${p.seller?.display_name ?? ""}`.toLowerCase().includes(query.toLowerCase()))) return false;
      if (nearbyOnly && p.location === "Online") return false;
      if (escrowOnly && !p.escrow) return false;
      if (Number(p.price) > maxPrice) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    return list;
  }, [items, query, sort, nearbyOnly, escrowOnly, maxPrice]);

  const activeFilters = [nearbyOnly, escrowOnly, maxPrice < 10000].filter(Boolean).length;
  const featured = items[0];

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-2xl">Market</h1>
          <p className="text-xs text-muted">Buy & sell — protected by Nova Escrow 🛡️</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface2 rounded-full p-1">
            {([["browse", "🛍️ Browse"], ["orders", "📦 Orders"]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`px-3 h-8 rounded-full text-xs font-bold whitespace-nowrap ${view === id ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSellOpen(true)}
            className="h-10 px-4 rounded-full nova-gradient text-white text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-hot-pink/25 press"
          >
            <Plus size={17} strokeWidth={2.5} /> Sell
          </button>
        </div>
      </div>

      {view === "orders" ? (
        <OrdersView notify={notify} />
      ) : (
        <>
          <div className="px-4">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anything…"
                className="w-full bg-surface2 rounded-full pl-11 pr-4 h-11 text-sm outline-none focus:ring-2 ring-nova-purple/40"
              />
            </div>
          </div>

          <div className="flex gap-2 px-4 mt-3 overflow-x-auto no-scrollbar">
            {productCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`px-4 h-9 rounded-full text-sm font-bold whitespace-nowrap flex items-center gap-1.5 border transition-colors ${
                  cat === c.id ? "nova-gradient text-white border-transparent" : "bg-surface2 border-line text-muted"
                }`}
              >
                <span>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-4 mt-3">
            <div className="flex flex-1 bg-surface2 rounded-full p-1 overflow-x-auto no-scrollbar">
              {([["relevant", "✨ Best match"], ["price-asc", "💰 Low → high"], ["price-desc", "💎 High → low"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  className={`px-3 h-8 rounded-full text-xs font-bold whitespace-nowrap ${sort === id ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className="h-9 px-4 rounded-full border border-line font-bold text-sm text-nova-purple flex items-center gap-1.5 relative shrink-0"
            >
              <SlidersHorizontal size={15} /> Filters
              {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full nova-gradient text-white text-[10px] font-bold flex items-center justify-center">{activeFilters}</span>}
            </button>
          </div>

          {featured && !query && cat === "all" && (
            <button onClick={() => setDetail(featured)} className="mx-4 mt-4 w-[calc(100%-2rem)] rounded-3xl overflow-hidden relative text-left" style={{ background: featured.gradient ?? "var(--gradient-nova)", aspectRatio: "16/7" }}>
              <ProductMedia p={featured} emojiClass="text-7xl opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 p-4 text-white">
                <span className="text-[10px] font-extrabold tracking-widest bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">FEATURED</span>
                <p className="font-heading font-bold mt-1.5">{featured.title}</p>
                <p className="font-extrabold nova-gradient-text">{fmtPrice(Number(featured.price))}</p>
              </div>
            </button>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-3 px-4 mt-4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 px-4 mt-4">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => setDetail(p)} className="card !rounded-2xl overflow-hidden text-left hover:border-nova-purple/40 transition-colors">
                  <div className="relative" style={{ background: p.gradient ?? "var(--gradient-nova)", aspectRatio: "1/1" }}>
                    <ProductMedia p={p} emojiClass="text-5xl" />
                    <button
                      onClick={(e) => { e.stopPropagation(); void toggleFav(p); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
                      aria-label="Save"
                    >
                      <Heart size={15} className="text-white" fill={favorites.has(p.id) ? "currentColor" : "none"} />
                    </button>
                    {p.escrow && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[9px] font-extrabold flex items-center gap-0.5">
                        <ShieldCheck size={9} /> ESCROW
                      </span>
                    )}
                    {p.condition && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur text-white text-[10px] font-bold">
                        {p.condition}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-sm leading-tight line-clamp-2">{p.title}</p>
                    <p className="font-extrabold text-nova-purple mt-1">
                      {fmtPrice(Number(p.price))}
                      {p.original_price && <span className="text-muted line-through text-xs font-semibold ml-1.5">{fmtPrice(Number(p.original_price))}</span>}
                    </p>
                    <p className="text-[11px] text-muted mt-1 flex items-center gap-1"><MapPin size={10} /> {p.location ?? "Global"}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Avatar user={sellerUser(p)} size={18} />
                      <span className="text-[11px] text-muted truncate">{(p.seller?.display_name ?? "Seller").split(" ")[0]}</span>
                      {p.seller?.is_verified && <BadgeCheck size={12} className="text-nova-purple" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-14 text-muted px-6">
              <p className="text-4xl mb-2">🛍️</p>
              <p className="font-bold text-ink">Nothing here yet</p>
              <p className="text-sm mt-1">Be the first to list something — tap Sell above.</p>
            </div>
          )}
        </>
      )}

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Max price — {fmtPrice(maxPrice)}</p>
            <input type="range" min={10} max={10000} step={10} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-[#FF6B00]" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Trust & delivery</p>
            <label className="flex items-center gap-3 card !rounded-2xl p-3.5 cursor-pointer">
              <input type="checkbox" checked={escrowOnly} onChange={(e) => setEscrowOnly(e.target.checked)} className="w-4 h-4 accent-[#FF6B00]" />
              <ShieldCheck size={17} className="text-emerald-500" />
              <span className="text-sm font-bold">Nova Escrow only <span className="block text-xs text-muted font-semibold">Money held until you confirm delivery</span></span>
            </label>
            <label className="flex items-center gap-3 card !rounded-2xl p-3.5 cursor-pointer">
              <input type="checkbox" checked={nearbyOnly} onChange={(e) => setNearbyOnly(e.target.checked)} className="w-4 h-4 accent-[#FF6B00]" />
              <MapPin size={17} className="text-nova-purple" />
              <span className="text-sm font-bold">Local sellers only</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setMaxPrice(10000); setNearbyOnly(false); setEscrowOnly(false); }} className="flex-1 h-11 rounded-2xl bg-surface2 font-bold text-sm text-muted">Reset</button>
            <button onClick={() => setFiltersOpen(false)} className="flex-1 h-11 rounded-2xl nova-gradient text-white font-bold text-sm">Show {filtered.length} results</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={!!detail} onClose={() => setDetail(null)} title="">
        {detail && (
          <ProductDetail
            p={detail}
            fav={favorites.has(detail.id)}
            isMine={!!me && detail.seller?.id === me.id}
            onFav={() => void toggleFav(detail)}
            onOffer={() => { setOfferFor(detail); }}
            onBuy={() => { setBuyFor(detail); }}
            onMessage={onMessageSeller}
            notify={notify}
          />
        )}
      </BottomSheet>

      <BottomSheet open={sellOpen} onClose={() => setSellOpen(false)} title="List an item">
        <SellForm onDone={() => { setSellOpen(false); load(); notify("Listing published 🎉"); }} />
      </BottomSheet>

      <BottomSheet open={!!offerFor} onClose={() => setOfferFor(null)} title="Make an offer">
        {offerFor && (
          <OfferForm
            product={offerFor}
            onDone={() => { setOfferFor(null); notify("Offer sent — the seller will respond"); }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={!!buyFor} onClose={() => setBuyFor(null)} title="Buy with Escrow">
        {buyFor && (
          <BuyConfirm
            product={buyFor}
            onDone={() => { setBuyFor(null); setView("orders"); }}
            notify={notify}
          />
        )}
      </BottomSheet>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full bg-ink text-bg text-sm font-bold shadow-xl flex items-center gap-2 whitespace-nowrap">
          <CheckCircle2 size={15} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}

function ProductMedia({ p, emojiClass }: { p: any; emojiClass: string }) {
  const url = Array.isArray(p.images) && p.images.length ? p.images[0] : null;
  if (url) {
    return <img src={url} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />;
  }
  return <div className="absolute inset-0 flex items-center justify-center"><span className={`${emojiClass} opacity-80`}>{p.emoji ?? "📦"}</span></div>;
}

function ProductDetail({
  p, fav, isMine, onFav, onOffer, onBuy, onMessage, notify,
}: {
  p: any;
  fav: boolean;
  isMine: boolean;
  onFav: () => void;
  onOffer: () => void;
  onBuy: () => void;
  onMessage?: (userId: string) => void;
  notify: (msg: string) => void;
}) {
  const seller = sellerUser(p);
  const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  const [hero, setHero] = useState(0);
  const heroUrl = images[hero];

  return (
    <div>
      <div className="-mx-5 -mt-2 mb-4 relative" style={{ background: p.gradient ?? "var(--gradient-nova)", aspectRatio: "4/3" }}>
        {heroUrl ? (
          <img src={heroUrl} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"><span className="text-8xl">{p.emoji ?? "📦"}</span></div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {p.escrow && <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold flex items-center gap-1"><ShieldCheck size={11} /> NOVA ESCROW</span>}
          {p.condition && <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur text-white text-[10px] font-bold">{p.condition}</span>}
        </div>
        <button
          onClick={onFav}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
          aria-label="Save"
        >
          <Heart size={16} className="text-white" fill={fav ? "currentColor" : "none"} />
        </button>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 -mt-2 mb-3 overflow-x-auto no-scrollbar">
          {images.map((u: string, i: number) => (
            <button
              key={u}
              onClick={() => setHero(i)}
              className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 ${i === hero ? "border-nova-purple" : "border-transparent"}`}
            >
              <img src={u} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading font-bold text-lg leading-tight">{p.title}</h3>
        <button onClick={() => {}} className="text-muted hover:text-coral shrink-0" aria-label="Remove"><X size={18} /></button>
      </div>
      <p className="font-extrabold text-xl text-nova-purple mt-1">
        {fmtPrice(Number(p.price))}
        {p.original_price && <span className="text-muted line-through text-sm font-semibold ml-2">{fmtPrice(Number(p.original_price))}</span>}
      </p>
      <p className="text-xs text-muted mt-1 flex items-center gap-1"><MapPin size={11} /> {p.location ?? "Global"} · listed {new Date(p.created_at).toLocaleDateString()}</p>
      {p.description && <p className="text-sm text-muted mt-3 leading-relaxed">{p.description}</p>}

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { icon: ShieldCheck, label: "Escrow protection", sub: "Pay safely" },
          { icon: Truck, label: "Delivery options", sub: "Pickup or ship" },
          { icon: RotateCcw, label: "7-day returns", sub: "Not as described" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="card !rounded-2xl p-3 text-center">
            <Icon size={18} className="mx-auto text-nova-purple" />
            <p className="text-[11px] font-bold mt-1">{label}</p>
            <p className="text-[10px] text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="card !rounded-2xl p-4 mt-3 flex items-center gap-3">
        <Avatar user={seller} size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm flex items-center gap-1 truncate">{seller.name} {seller.verified && <VerifiedBadge />}</p>
          <p className="text-xs text-muted">@{seller.handle}</p>
        </div>
        {!isMine && seller.id !== "seller" && onMessage && (
          <button
            onClick={() => onMessage(seller.id)}
            className="w-9 h-9 rounded-full bg-surface2 flex items-center justify-center text-nova-purple"
            aria-label="Message seller"
          >
            <MessageCircle size={17} />
          </button>
        )}
      </div>

      {isMine ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Offers on your listing</p>
          <OffersPanel productId={p.id} notify={notify} />
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted text-center mt-3 flex items-center justify-center gap-1">
            <Eye size={11} /> {p.watchers ?? 0} people watching this item
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={onOffer} className="flex-1 h-12 rounded-2xl bg-surface2 border border-line font-bold text-sm text-nova-purple">Make offer</button>
            <button onClick={onBuy} className="flex-1 h-12 rounded-2xl nova-gradient text-white font-bold text-sm press">Buy with Escrow</button>
          </div>
          <p className="text-[11px] text-muted text-center mt-2">🔒 Your money is held safely until you confirm the item arrives.</p>
        </>
      )}
    </div>
  );
}

function OffersPanel({ productId, notify }: { productId: string; notify: (m: string) => void }) {
  const [offers, setOffers] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchProductOffers(productId).then((d) => { if (live) setOffers(d); });
    return () => { live = false; };
  }, [productId]);

  const respond = async (offerId: string, accept: boolean) => {
    setBusy(offerId);
    const res = await respondToOffer(offerId, accept);
    setBusy(null);
    if (!res.ok) {
      notify(res.error?.includes("insufficient_funds") ? "Buyer's wallet can't cover this offer" : "Couldn't update offer");
    } else {
      notify(accept ? "Offer accepted — escrow order placed 🛡️" : "Offer declined");
    }
    void fetchProductOffers(productId).then(setOffers);
  };

  if (offers === null) return <div className="skeleton h-16 rounded-2xl" />;
  if (offers.length === 0) {
    return <p className="text-sm text-muted card !rounded-2xl p-4 text-center">No offers yet.</p>;
  }
  return (
    <div className="space-y-2">
      {offers.map((o) => {
        const buyer = sellerUser({ seller: o.buyer });
        const pending = o.status === "pending";
        return (
          <div key={o.id} className="card !rounded-2xl p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar user={buyer} size={34} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{buyer.name}</p>
                <p className="text-[11px] text-muted">{new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <p className="font-extrabold text-nova-purple">{fmtPrice(Number(o.amount))}</p>
            </div>
            {o.message && <p className="text-xs text-muted mt-2">“{o.message}”</p>}
            <div className="flex items-center justify-between mt-2.5">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                o.status === "accepted" ? "bg-emerald-500/15 text-emerald-500"
                : o.status === "pending" ? "bg-amber-500/15 text-amber-500"
                : "bg-surface2 text-muted"
              }`}>{o.status}</span>
              {pending && (
                <div className="flex gap-2">
                  <button
                    onClick={() => void respond(o.id, false)}
                    disabled={busy === o.id}
                    className="h-8 px-3 rounded-full bg-surface2 text-xs font-bold text-muted disabled:opacity-40"
                  >Decline</button>
                  <button
                    onClick={() => void respond(o.id, true)}
                    disabled={busy === o.id}
                    className="h-8 px-3 rounded-full nova-gradient text-white text-xs font-bold disabled:opacity-40 press"
                  >Accept</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OfferForm({ product, onDone }: { product: any; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return;
    setBusy(true);
    setError(null);
    const id = await createOffer(product.id, n, message);
    setBusy(false);
    if (!id) { setError("Couldn't send offer — check the amount and try again."); return; }
    setDone(true);
    setTimeout(onDone, 900);
  };

  return (
    <div className="space-y-3">
      <div className="card !rounded-2xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: product.gradient ?? "var(--gradient-nova)" }}>
          {product.emoji ?? "📦"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{product.title}</p>
          <p className="text-xs text-muted">Listed at {fmtPrice(Number(product.price))}</p>
        </div>
      </div>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Your offer (USD)"
        type="number"
        min="1"
        className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Add a message (optional)…"
        rows={3}
        className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none"
      />
      {error && <p className="text-xs text-coral font-semibold flex items-center gap-1"><AlertCircle size={13} /> {error}</p>}
      <button
        onClick={() => void submit()}
        disabled={!Number(amount) || busy || done}
        className="w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40 press"
      >
        {done ? "Offer sent! 🎉" : busy ? "Sending…" : "Send offer"}
      </button>
      <p className="text-[11px] text-muted text-center">If accepted, funds are held in escrow until delivery is confirmed.</p>
    </div>
  );
}

function BuyConfirm({ product, onDone, notify }: { product: any; onDone: () => void; notify: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await placeOrder(product.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error?.includes("insufficient_funds")
        ? "Not enough NOVA coins — top up your wallet first."
        : "Couldn't place order — the item may no longer be available.");
      return;
    }
    setDone(true);
    notify("Order placed — funds held in escrow 🛡️");
    setTimeout(onDone, 1100);
  };

  return (
    <div className="space-y-3">
      <div className="card !rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: product.gradient ?? "var(--gradient-nova)" }}>
            {product.emoji ?? "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{product.title}</p>
            <p className="text-xs text-muted">{product.location ?? "Global"}</p>
          </div>
          <p className="font-extrabold text-nova-purple">{fmtPrice(Number(product.price))}</p>
        </div>
      </div>
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 text-xs text-muted flex gap-2">
        <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
        <span><b className="text-ink">Nova Escrow:</b> the full amount is deducted now and held safely. The seller is paid 90% only after you confirm the item arrived. Platform fee: 10%.</span>
      </div>
      {error && <p className="text-xs text-coral font-semibold flex items-center gap-1"><AlertCircle size={13} /> {error}</p>}
      <button
        onClick={() => void submit()}
        disabled={busy || done}
        className="w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40 press flex items-center justify-center gap-2"
      >
        {done ? <><CheckCircle2 size={16} /> Order placed!</> : busy ? "Placing order…" : <><Wallet size={15} /> Pay {fmtPrice(Number(product.price))} with Escrow</>}
      </button>
    </div>
  );
}

function OrdersView({ notify }: { notify: (m: string) => void }) {
  const [role, setRole] = useState<"buying" | "selling">("buying");
  const [orders, setOrders] = useState<{ role: string; list: any[] | null }>({ role, list: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchMyOrders(role).then((d) => { if (live) setOrders({ role, list: d }); });
    return () => { live = false; };
  }, [role]);
  const list = orders.role === role ? orders.list : null;

  const act = async (orderId: string, kind: "complete" | "cancel") => {
    setBusy(orderId);
    const res = kind === "complete" ? await completeOrder(orderId) : await cancelOrder(orderId);
    setBusy(null);
    setConfirmCancel(null);
    if (!res.ok) {
      notify(res.error === "insufficient_funds" ? "Something went wrong" : "Couldn't update order");
    } else {
      notify(kind === "complete" ? "Order completed — seller paid 🛡️" : "Order cancelled — buyer refunded");
    }
    void fetchMyOrders(role).then((d) => setOrders({ role, list: d }));
  };

  return (
    <div className="px-4 mt-3">
      <div className="flex bg-surface2 rounded-full p-1 w-fit">
        {([["buying", "Buying"], ["selling", "Selling"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setRole(id)}
            className={`px-4 h-8 rounded-full text-xs font-bold ${role === id ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {list === null ? (
        <div className="space-y-3 mt-4">{[0, 1].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : list.length === 0 ? (
        <div className="text-center py-14 text-muted">
          <p className="text-4xl mb-2">📦</p>
          <p className="font-bold text-ink">No {role === "buying" ? "purchases" : "sales"} yet</p>
          <p className="text-sm mt-1">{role === "buying" ? "Items you buy with Escrow will show up here." : "When someone buys your listings, orders appear here."}</p>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {list.map((o) => {
            const other = role === "buying" ? o.seller : o.buyer;
            const otherName = other?.display_name ?? other?.username ?? "Unknown";
            const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.held;
            const held = o.status === "held";
            return (
              <div key={o.id} className="card !rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: o.product?.gradient ?? "var(--gradient-nova)" }}>
                    {o.product?.images?.[0] ? <img src={o.product.images[0]} alt="" className="w-full h-full object-cover rounded-xl" /> : (o.product?.emoji ?? "📦")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{o.product?.title ?? "Deleted item"}</p>
                    <p className="text-[11px] text-muted truncate">
                      {role === "buying" ? `Seller: ${otherName}` : `Buyer: ${otherName}`} · {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-nova-purple">{fmtPrice(Number(o.amount))}</p>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                </div>
                {held && (
                  <div className="flex gap-2 mt-3">
                    {role === "buying" && (
                      <button
                        onClick={() => void act(o.id, "complete")}
                        disabled={busy === o.id}
                        className="flex-1 h-9 rounded-xl nova-gradient text-white text-xs font-bold disabled:opacity-40 press"
                      >
                        Confirm receipt
                      </button>
                    )}
                    {confirmCancel === o.id ? (
                      <>
                        <button
                          onClick={() => setConfirmCancel(null)}
                          className="flex-1 h-9 rounded-xl bg-surface2 text-xs font-bold text-muted"
                        >Keep order</button>
                        <button
                          onClick={() => void act(o.id, "cancel")}
                          disabled={busy === o.id}
                          className="flex-1 h-9 rounded-xl bg-coral/15 text-coral text-xs font-bold disabled:opacity-40"
                        >
                          {role === "buying" ? "Yes, cancel & refund me" : "Yes, cancel & refund buyer"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmCancel(o.id)}
                        disabled={busy === o.id}
                        className="flex-1 h-9 rounded-xl bg-surface2 border border-line text-xs font-bold text-muted disabled:opacity-40"
                      >
                        Cancel order
                      </button>
                    )}
                  </div>
                )}
                {o.status === "completed" && role === "selling" && (
                  <p className="text-[11px] text-emerald-500 font-semibold mt-2">Seller paid 90% — platform fee 10% 🛡️</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SellForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("electronics");
  const [condition, setCondition] = useState("Good");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, 6);
    setFiles((fs) => [...fs, ...imgs].slice(0, 6));
    setPreviews((ps) => [...ps, ...imgs.map((f) => URL.createObjectURL(f))].slice(0, 6));
  };

  const removeImage = (i: number) => {
    setFiles((fs) => fs.filter((_, j) => j !== i));
    setPreviews((ps) => { const u = ps[i]; if (u) URL.revokeObjectURL(u); return ps.filter((_, j) => j !== i); });
  };

  const submit = async () => {
    if (!title.trim() || !price) return;
    setBusy(true);
    setError(null);
    const imageUrls: string[] = [];
    for (const f of files) {
      const url = await uploadProductImage(f);
      if (url) imageUrls.push(url);
    }
    const emoji = productCategories.find((c) => c.id === category)?.emoji ?? "📦";
    const id = await createProductWithImages({
      title: title.trim(),
      description: desc.trim() || undefined,
      price: Number(price),
      category,
      condition,
      location: location.trim() || undefined,
      emoji,
      imageUrls,
    });
    setBusy(false);
    if (!id) { setError("Couldn't publish — please try again."); return; }
    setDone(true);
    setTimeout(onDone, 900);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
      />
      {previews.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {previews.map((u, i) => (
            <div key={u} className="relative w-20 h-20 rounded-2xl overflow-hidden">
              <img src={u} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                aria-label="Remove photo"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {files.length < 6 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-nova-purple/40 flex items-center justify-center text-muted"
              aria-label="Add photo"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full h-28 rounded-2xl border-2 border-dashed border-nova-purple/40 flex flex-col items-center justify-center text-muted gap-1 hover:border-nova-purple/70 transition-colors"
        >
          <ImagePlus size={26} className="text-nova-purple" />
          <span className="text-sm font-bold">Add photos</span>
          <span className="text-[11px]">Tap to upload — up to 6</span>
        </button>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you selling?" className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
      <div className="flex gap-2">
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (USD)" type="number" min="1" className="flex-1 bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
        <select value={condition} onChange={(e) => setCondition(e.target.value)} className="bg-surface2 rounded-2xl px-3 py-3 text-sm font-bold outline-none">
          <option>New</option><option>Like new</option><option>Good</option><option>Fair</option>
        </select>
      </div>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm font-bold outline-none">
        {productCategories.filter((c) => c.id !== "all").map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
      </select>
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Nairobi, Kenya)" className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe condition, size, what's included…" rows={3} className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none" />
      {error && <p className="text-xs text-coral font-semibold flex items-center gap-1"><AlertCircle size={13} /> {error}</p>}
      <button onClick={() => void submit()} disabled={!title.trim() || !Number(price) || busy || done} className="w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40 press">
        {done ? "Published! 🎉" : busy ? "Publishing…" : "Publish listing"}
      </button>
      <p className="text-[11px] text-muted text-center flex items-center gap-1"><Tag size={11} /> Listing fee: 2% only when it sells</p>
    </div>
  );
}
