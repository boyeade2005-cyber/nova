export type ReactionType = "like" | "love" | "laugh" | "wow" | "support";

export interface User {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  avatarEmoji: string;
  bio?: string;
  location?: string;
  country?: string;
  region?: string;
  verified?: boolean;
  interests?: string[];
}

export interface Comment {
  id: string;
  author: User;
  text: string;
  time: string;
  voice?: string;
  voiceUrl?: string;
  transcript?: string;
  transcriptLang?: string;
  replies?: Comment[];
}

export interface MediaItem {
  kind: "photo" | "video" | "audio";
  url?: string;
  gradient: string;
  emoji: string;
  label?: string;
  duration?: string;
}

export interface Post {
  id: string;
  author: User;
  time: string;
  text: string;
  topics: string[];
  location?: string;
  media?: MediaItem[];
  reactions: Record<ReactionType, number>;
  myReaction?: ReactionType | null;
  comments: Comment[];
  shares: number;
  saves: number;
  saved?: boolean;
  community?: string;
  communityId?: string;
  country?: string;
  whySeeing: string;
}

export interface Moment {
  id: string;
  user: User;
  gradient: string;
  emoji: string;
  caption?: string;
  viewed?: boolean;
}

export interface Community {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  members: number;
  description: string;
  category: string;
  joined?: boolean;
}

export interface Conversation {
  id: string;
  kind: "dm" | "group" | "community" | "voice" | "channel" | "saved" | "secret";
  name: string;
  emoji: string;
  gradient: string;
  lastMessage: string;
  time: string;
  unread: number;
  online?: boolean;
  members?: string[];
  secret?: boolean;
  subscribers?: number;
  verified?: boolean;
}

export interface Trend {
  id: string;
  tag: string;
  posts: string;
  category: string;
}

export const currentUser: User = {
  id: "me",
  name: "David",
  handle: "david_builds",
  avatarColor: "#2F6BFF",
  avatarEmoji: "🦊",
  bio: "Building cool things on the web 🌐",
  location: "Nairobi, Kenya",
  interests: ["Tech", "Music", "Faith"],
};

export const users: Record<string, User> = {
  amara: {
    id: "amara",
    name: "Amara Okafor",
    handle: "amara.codes",
    avatarColor: "#00C2D1",
    avatarEmoji: "👩🏾‍💻",
    bio: "Frontend dev & open source lover",
    location: "Lagos, Nigeria",
    verified: true,
    interests: ["Tech", "Education"],
  },
  kwame: {
    id: "kwame",
    name: "Kwame Mensah",
    handle: "kwame.frames",
    avatarColor: "#0EA5E9",
    avatarEmoji: "🎬",
    bio: "Filmmaker telling African stories",
    location: "Accra, Ghana",
    interests: ["Entertainment", "Arts"],
  },
  zanele: {
    id: "zanele",
    name: "Zanele Mokoena",
    handle: "zanele.grows",
    avatarColor: "#10B981",
    avatarEmoji: "🌱",
    bio: "Community gardener & nutrition nerd",
    location: "Johannesburg, South Africa",
    interests: ["Health", "Friends"],
  },
  yusuf: {
    id: "yusuf",
    name: "Yusuf Bello",
    handle: "yusuf.pitch",
    avatarColor: "#F59E0B",
    avatarEmoji: "⚽",
    bio: "Football coach. Grassroots matters.",
    location: "Kano, Nigeria",
    interests: ["Sports", "Community"],
  },
  linah: {
    id: "linah",
    name: "Linah Wanjiru",
    handle: "linah.live",
    avatarColor: "#8B5CF6",
    avatarEmoji: "🎤",
    bio: "Live music host — Pulse every Friday",
    location: "Nairobi, Kenya",
    verified: true,
    interests: ["Music", "Entertainment"],
  },
  sipho: {
    id: "sipho",
    name: "Sipho Dlamini",
    handle: "sipho.books",
    avatarColor: "#EC4899",
    avatarEmoji: "📚",
    bio: "Bookstagrammer. Stories change lives.",
    location: "Durban, South Africa",
    interests: ["Education", "Faith"],
  },
};

export const seedPosts: Post[] = [
  {
    id: "p1",
    author: users.amara,
    time: "12m",
    text: "Just shipped my first open-source UI kit on GitHub 🎉 It's called Pebble — rounded, warm, and free forever. Feedback welcome, especially from fellow frontend devs! #buildinpublic #opensource",
    topics: ["Tech", "Business"],
    location: "Lagos, Nigeria",
    media: [
      { kind: "photo", gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)", emoji: "🧱", label: "Pebble UI kit preview" },
      { kind: "photo", gradient: "linear-gradient(135deg,#00C2D1,#FF7A6B)", emoji: "🎨", label: "Component sheet" },
    ],
    reactions: { like: 124, love: 89, laugh: 12, wow: 34, support: 21 },
    comments: [
      { id: "c1", author: users.kwame, text: "This palette is *chef's kiss*. Using it for my next film site.", time: "8m" },
      { id: "c2", author: users.sipho, text: "So clean! The dark mode tokens are well thought out too.", time: "5m", replies: [
        { id: "c2r", author: users.amara, text: "Thank you! Dark mode was the hardest part honestly 😅", time: "3m" },
      ]},
    ],
    shares: 18,
    saves: 46,
    community: "Builders of Africa",
    whySeeing: "You're in Builders of Africa and follow #Tech",
  },
  {
    id: "p2",
    author: users.linah,
    time: "45m",
    text: "PULSE FRIDAY IS LIVE 🔥 This week: amapiano meets Amapiano — three artists, one rooftop, Nairobi skyline behind us. Swipe up, the energy is unreal. Tips go straight to the artists 🎤",
    topics: ["Music", "Entertainment"],
    location: "Nairobi, Kenya",
    media: [{ kind: "video", gradient: "linear-gradient(160deg,#FF7A6B,#2F6BFF)", emoji: "🎧", label: "Pulse live — Rooftop Sessions", duration: "0:58" }],
    reactions: { like: 890, love: 412, laugh: 30, wow: 120, support: 88 },
    comments: [
      { id: "c3", author: users.yusuf, text: "The crowd going OFF 🔥🔥", time: "30m" },
    ],
    shares: 156,
    saves: 74,
    whySeeing: "Music is one of your feed interests",
  },
  {
    id: "p3",
    author: users.zanele,
    time: "2h",
    text: "Community garden update: our first harvest is in! 40kg of sukuma wiki and tomatoes shared between 12 families. This is what happens when neighbours grow together 🌱 Swipe for the before/after",
    topics: ["Health", "Community"],
    location: "Johannesburg, South Africa",
    media: [
      { kind: "photo", gradient: "linear-gradient(135deg,#10B981,#0EA5E9)", emoji: "🥬", label: "Harvest day" },
      { kind: "photo", gradient: "linear-gradient(135deg,#0EA5E9,#2F6BFF)", emoji: "🪴", label: "Seedlings, week 1" },
    ],
    reactions: { like: 234, love: 301, laugh: 8, wow: 45, support: 167 },
    comments: [
      { id: "c4", author: users.sipho, text: "This gives me hope for my street too. How did you get the land?", time: "1h", replies: [
        { id: "c4r", author: users.zanele, text: "The ward councillor helped + a small grant from a local NGO. Happy to share the playbook!", time: "45m" },
      ]},
    ],
    shares: 92,
    saves: 133,
    community: "Green Roots",
    whySeeing: "You follow Green Roots community",
  },
  {
    id: "p4",
    author: users.yusuf,
    time: "4h",
    text: "Our U-14 team just qualified for the regional finals — first time in school history 🏆 Shoutout to Coach Ibrahim and every parent who drove to away games. Grassroots football changes lives.",
    topics: ["Sports", "Community"],
    location: "Kano, Nigeria",
    media: [{ kind: "photo", gradient: "linear-gradient(135deg,#F59E0B,#FF7A6B)", emoji: "🏆", label: "Team with trophy" }],
    reactions: { like: 512, love: 388, laugh: 15, wow: 60, support: 210 },
    comments: [],
    shares: 44,
    saves: 28,
    whySeeing: "Trending in Sports near you",
  },
  {
    id: "p5",
    author: users.kwame,
    time: "6h",
    text: "Day 12 of shooting my short film 'Adowa'. Golden hour in the Cape Coast castle and the light did ALL the work. No filter could touch this. Full behind-the-scenes on my Pulse 📽️",
    topics: ["Entertainment"],
    location: "Cape Coast, Ghana",
    media: [
      { kind: "photo", gradient: "linear-gradient(135deg,#B45309,#00C2D1)", emoji: "🌅", label: "Golden hour at the castle" },
      { kind: "video", gradient: "linear-gradient(160deg,#1E3A8A,#FF7A6B)", emoji: "🎬", label: "BTS — Day 12", duration: "1:12" },
    ],
    reactions: { like: 445, love: 267, laugh: 22, wow: 98, support: 55 },
    comments: [
      { id: "c5", author: users.linah, text: "The framing on that second shot is cinema. Can't wait for release 🙌", time: "5h" },
      { id: "c6", author: users.amara, text: "What are you shooting on? That dynamic range is unreal.", time: "4h" },
    ],
    shares: 61,
    saves: 89,
    whySeeing: "Entertainment is high in your feed sliders",
  },
  {
    id: "p6",
    author: users.sipho,
    time: "9h",
    text: "Unpopular opinion: you don't need to 'find yourself'. You build yourself — one honest conversation, one finished book, one kept promise at a time. Start where you are. 📖",
    topics: ["Education", "Faith"],
    media: [{ kind: "audio", gradient: "linear-gradient(135deg,#8B5CF6,#2F6BFF)", emoji: "🎙️", label: "Voice note — 1:24", duration: "1:24" }],
    reactions: { like: 178, love: 264, laugh: 5, wow: 31, support: 190 },
    comments: [
      { id: "c7", author: currentUser, text: "Needed this today, thank you Sipho 🙏", time: "8h" },
    ],
    shares: 73,
    saves: 112,
    whySeeing: "Following feed — chronological",
  },
];

/** Build a local Post shell for optimistic UI — `id` should be the real remote post id when possible. */
export function makeLocalPost(me: User, text: string, id: string, media?: MediaItem[]): Post {
  return {
    id,
    author: me,
    time: "now",
    text,
    topics: ["Friends"],
    media,
    reactions: { like: 0, love: 0, laugh: 0, wow: 0, support: 0 },
    comments: [],
    shares: 0,
    saves: 0,
    myReaction: null,
    whySeeing: "You just posted this",
  };
}

export function makePost(text: string): Post {
  return {
    id: `p${Date.now()}`,
    author: currentUser,
    time: "now",
    text,
    topics: ["Friends"],
    reactions: { like: 0, love: 0, laugh: 0, wow: 0, support: 0 },
    comments: [],
    shares: 0,
    saves: 0,
    myReaction: null,
    whySeeing: "You just posted this",
  };
}

export const moments: Moment[] = [
  { id: "m1", user: currentUser, gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)", emoji: "✨" },
  { id: "m2", user: users.amara, gradient: "linear-gradient(135deg,#00C2D1,#FF7A6B)", emoji: "💻" },
  { id: "m3", user: users.linah, gradient: "linear-gradient(135deg,#FF7A6B,#F59E0B)", emoji: "🎤" },
  { id: "m4", user: users.zanele, gradient: "linear-gradient(135deg,#10B981,#0EA5E9)", emoji: "🌱" },
  { id: "m5", user: users.kwame, gradient: "linear-gradient(135deg,#B45309,#00C2D1)", emoji: "🎬" },
  { id: "m6", user: users.yusuf, gradient: "linear-gradient(135deg,#F59E0B,#EF4444)", emoji: "⚽" },
  { id: "m7", user: users.sipho, gradient: "linear-gradient(135deg,#EC4899,#8B5CF6)", emoji: "📚" },
];

export const communities: Community[] = [
  { id: "cm1", name: "Builders of Africa", emoji: "🛠️", gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)", members: 48200, description: "Developers, designers and makers building the future of African tech.", category: "Tech" },
  { id: "cm2", name: "Green Roots", emoji: "🌱", gradient: "linear-gradient(135deg,#10B981,#0EA5E9)", members: 12700, description: "Community gardens, urban farming and food sovereignty.", category: "Health", joined: true },
  { id: "cm3", name: "Pulse Live Fans", emoji: "🎧", gradient: "linear-gradient(135deg,#FF7A6B,#2F6BFF)", members: 96400, description: "For everyone who feels the music. Live every Friday.", category: "Music" },
  { id: "cm4", name: "Faith & Fellowship", emoji: "🙏", gradient: "linear-gradient(135deg,#F59E0B,#EC4899)", members: 35100, description: "Encouragement, scripture and real-life faith conversations.", category: "Faith" },
  { id: "cm5", name: "Streetball Sundays", emoji: "🏀", gradient: "linear-gradient(135deg,#EF4444,#F59E0B)", members: 8940, description: "Pickup games, drills and tournaments near you.", category: "Sports", joined: true },
  { id: "cm6", name: "Book Club: Nairobi", emoji: "📖", gradient: "linear-gradient(135deg,#8B5CF6,#EC4899)", members: 5620, description: "One book a month. Come discuss over chai.", category: "Education" },
];

export const conversations: Conversation[] = [
  { id: "cv1", kind: "dm", name: "Amara Okafor", emoji: "👩🏾‍💻", gradient: "linear-gradient(135deg,#00C2D1,#FF7A6B)", lastMessage: "That deploy pipeline is *chef's kiss* 🔥", time: "2m", unread: 2, online: true },
  { id: "cv2", kind: "group", name: "Friday Pulse Crew", emoji: "🎧", gradient: "linear-gradient(135deg,#FF7A6B,#2F6BFF)", lastMessage: "Linah: doors open at 7pm sharp!", time: "18m", unread: 5, members: ["linah", "amara", "kwame"] },
  { id: "cv3", kind: "community", name: "Green Roots", emoji: "🌱", gradient: "linear-gradient(135deg,#10B981,#0EA5E9)", lastMessage: "Zanele: Harvest photos are up!", time: "1h", unread: 0 },
  { id: "cv4", kind: "voice", name: "Voice note — Sipho", emoji: "🎙️", gradient: "linear-gradient(135deg,#8B5CF6,#2F6BFF)", lastMessage: "Voice note · 1:24", time: "3h", unread: 1 },
  { id: "cv5", kind: "dm", name: "Kwame Mensah", emoji: "🎬", gradient: "linear-gradient(135deg,#0EA5E9,#2F6BFF)", lastMessage: "Sent a photo · castle at golden hour", time: "5h", unread: 0, online: false },
];

export const trends: Trend[] = [
  { id: "t1", tag: "#BuildInPublic", posts: "12.4K posts", category: "Tech" },
  { id: "t2", tag: "#PulseFriday", posts: "48.1K posts", category: "Music" },
  { id: "t3", tag: "#AdowaFilm", posts: "3.2K posts", category: "Entertainment" },
  { id: "t4", tag: "#CommunityGarden", posts: "7.8K posts", category: "Health" },
  { id: "t5", tag: "#StreetballSundays", posts: "1.9K posts", category: "Sports" },
];

export const feedTopics = [
  "Education", "Tech", "Business", "Entertainment", "Sports",
  "Friends", "Faith", "Music", "Health", "Arts", "Community", "Food",
];

export const interestChips = [
  "🎨 Arts", "💻 Tech", "⚽ Sports", "🎵 Music", "📚 Education",
  "🙏 Faith", "🍲 Food", "🌍 Travel", "💼 Business", "🏥 Health",
  "🎬 Film", "📸 Photography", "🧘 Wellness", "🐾 Animals",
];

// ---- Extended social features ----

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  kind: "text" | "image-once" | "video-once" | "voice" | "gift" | "system";
  text?: string;
  emoji?: string;
  gradient?: string;
  time: string;
  viewed?: boolean;
  reaction?: string;
  read?: boolean;
}

export const userStreaks: Record<string, number> = {
  amara: 24,
  linah: 56,
  zanele: 12,
  kwame: 8,
  sipho: 31,
  yusuf: 5,
};

export const chatMessages: Record<string, ChatMessage[]> = {
  cv1: [
    { id: "m1", from: "them", kind: "text", text: "Hey! Did you see the new Nova preview?", time: "10:02", read: true },
    { id: "m2", from: "me", kind: "text", text: "Just did!! The gradient on the create button is so good 🔥", time: "10:03", read: true },
    { id: "m3", from: "them", kind: "image-once", text: "My homepage mockup", gradient: "linear-gradient(135deg,#00C2D1,#FF7A6B)", emoji: "🖥️", time: "10:04", viewed: false },
    { id: "m4", from: "me", kind: "text", text: "Ooh send another! The story rings look clean", time: "10:05", read: true },
    { id: "m5", from: "them", kind: "voice", text: "Voice note · 0:42", time: "10:07", read: true },
    { id: "m6", from: "me", kind: "gift", text: "Sent you a 🌹 Rose", emoji: "🌹", time: "10:08", read: true },
    { id: "m7", from: "them", kind: "text", text: "aww thank you!! day 24 streak let's go 🔥🔥", time: "10:09", read: false },
  ],
  cv2: [
    { id: "m8", from: "them", kind: "system", text: "Linah added Kwame Mensah", time: "09:12" },
    { id: "m9", from: "them", kind: "text", text: "Friday Pulse crew!! Doors at 7pm sharp 🎧", time: "09:30", read: true },
    { id: "m10", from: "them", kind: "text", text: "Bring your dancing shoes, it's a rooftop session", time: "09:31", read: true },
    { id: "m11", from: "me", kind: "text", text: "I'm so there. Should I bring my camera?", time: "09:45", read: true },
    { id: "m12", from: "them", kind: "text", text: "YES. Content creator behaviour 🙌", time: "09:46", read: false },
  ],
  cv3: [
    { id: "m13", from: "them", kind: "image-once", text: "Harvest photos!", gradient: "linear-gradient(135deg,#10B981,#0EA5E9)", emoji: "🥬", time: "08:15", viewed: true },
    { id: "m14", from: "them", kind: "text", text: "40kg shared between 12 families 🌱", time: "08:16", read: true },
    { id: "m15", from: "me", kind: "text", text: "This is amazing work Zanele 🙏", time: "08:40", read: true },
  ],
  cv4: [
    { id: "m16", from: "them", kind: "voice", text: "Voice note · 1:24", time: "Yesterday", read: true },
    { id: "m17", from: "them", kind: "text", text: "Tell me what you think about this idea…", time: "Yesterday", read: true },
  ],
  cv5: [
    { id: "m18", from: "them", kind: "image-once", text: "Castle at golden hour", gradient: "linear-gradient(135deg,#B45309,#00C2D1)", emoji: "🌅", time: "Yesterday", viewed: false },
    { id: "m19", from: "me", kind: "text", text: "Kwame this is cinema. Seriously.", time: "Yesterday", read: true },
    { id: "m20", from: "them", kind: "video-once", text: "BTS clip", gradient: "linear-gradient(160deg,#1E3A8A,#FF7A6B)", emoji: "🎬", time: "Yesterday", viewed: false },
  ],
};

export interface NearbyPerson {
  id: string;
  user: User;
  distance: string;
  mutuals: number;
  bio: string;
}

export const nearbyPeople: NearbyPerson[] = [
  { id: "n1", user: users.amara, distance: "0.4 km", mutuals: 12, bio: "Open to collabs today" },
  { id: "n2", user: users.zanele, distance: "1.1 km", mutuals: 5, bio: "At the community garden" },
  { id: "n3", user: users.linah, distance: "2.3 km", mutuals: 31, bio: "Rehearsing for Friday" },
  { id: "n4", user: users.yusuf, distance: "3.8 km", mutuals: 2, bio: "Coaching U-14s" },
];

export interface LiveStream {
  id: string;
  host: User;
  title: string;
  viewers: number;
  gradient: string;
  emoji: string;
  category: string;
  gifts?: number;
  isLive?: boolean;
  scheduledAt?: string;
  communityId?: string;
  communityName?: string;
  country?: string;
}

export const liveStreams: LiveStream[] = [
  { id: "l1", host: users.linah, title: "Friday Pulse warm-up 🔥", viewers: 12840, gradient: "linear-gradient(160deg,#FF7A6B,#2F6BFF)", emoji: "🎧", category: "Music", gifts: 342 },
  { id: "l2", host: users.kwame, title: "Adowa BTS — answering questions", viewers: 3204, gradient: "linear-gradient(160deg,#B45309,#00C2D1)", emoji: "🎬", category: "Film", gifts: 87 },
  { id: "l3", host: users.zanele, title: "Garden tour + harvest prep", viewers: 987, gradient: "linear-gradient(160deg,#10B981,#0EA5E9)", emoji: "🌱", category: "Community", gifts: 23 },
];

export interface PulseVideo {
  id: string;
  creator: User;
  caption: string;
  gradient: string;
  emoji: string;
  likes: number;
  comments: number;
  shares: number;
  tips: number;
  music: string;
}

export const pulseVideos: PulseVideo[] = [
  { id: "v1", creator: users.linah, caption: "POV: Friday Pulse energy hits different 🔥", gradient: "linear-gradient(180deg,#FF7A6B,#2F6BFF)", emoji: "🎤", likes: 12400, comments: 843, shares: 1204, tips: 89, music: "Amapiano Remix · DJ Kelvin" },
  { id: "v2", creator: users.kwame, caption: "Golden hour does ALL the work 🌅 #Adowa", gradient: "linear-gradient(180deg,#B45309,#00C2D1)", emoji: "🎬", likes: 8900, comments: 512, shares: 640, tips: 45, music: "Original sound · kwame.frames" },
  { id: "v3", creator: users.zanele, caption: "From empty lot to food forest in 6 months 🌱", gradient: "linear-gradient(180deg,#10B981,#0EA5E9)", emoji: "🥬", likes: 5600, comments: 289, shares: 412, tips: 12, music: "Calm acoustic · Jo" },
  { id: "v4", creator: users.yusuf, caption: "U-14s training drills that actually work ⚽", gradient: "linear-gradient(180deg,#F59E0B,#EF4444)", emoji: "⚽", likes: 3200, comments: 178, shares: 230, tips: 8, music: "Original sound · yusuf.pitch" },
  { id: "v5", creator: users.amara, caption: "Watch me build a button component live 💻 #buildinpublic", gradient: "linear-gradient(180deg,#2F6BFF,#00C2D1)", emoji: "💻", likes: 4100, comments: 201, shares: 356, tips: 34, music: "Lo-fi beats · nova" },
];

export interface Gift {
  id: string;
  emoji: string;
  name: string;
  coins: number;
  gradient: string;
}

export const gifts: Gift[] = [
  { id: "g1", emoji: "🌹", name: "Rose", coins: 10, gradient: "linear-gradient(135deg,#00C2D1,#FF7A6B)" },
  { id: "g2", emoji: "🔥", name: "Fire", coins: 50, gradient: "linear-gradient(135deg,#F59E0B,#EF4444)" },
  { id: "g3", emoji: "👑", name: "Crown", coins: 200, gradient: "linear-gradient(135deg,#FBBF24,#F59E0B)" },
  { id: "g4", emoji: "🚀", name: "Rocket", coins: 500, gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)" },
  { id: "g5", emoji: "💎", name: "Diamond", coins: 1000, gradient: "linear-gradient(135deg,#0EA5E9,#2F6BFF)" },
  { id: "g6", emoji: "🌈", name: "Rainbow", coins: 99, gradient: "linear-gradient(135deg,#00C2D1,#FF7A6B)" },
];

export const novaScore = 842;
export const userCoins = 1250;

// ---- Marketplace ----

export interface Product {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  emoji: string;
  gradient: string;
  category: string;
  condition: "New" | "Like new" | "Good" | "Fair";
  location: string;
  distance: string;
  seller: User;
  rating: number;
  sales: number;
  listed: string;
  description: string;
  watchers: number;
  featured?: boolean;
  escrow?: boolean;
}

export const productCategories = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "electronics", label: "Electronics", emoji: "📱" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "home", label: "Home & Living", emoji: "🏠" },
  { id: "vehicles", label: "Vehicles", emoji: "🛵" },
  { id: "digital", label: "Digital", emoji: "💻" },
  { id: "beauty", label: "Beauty", emoji: "💄" },
  { id: "sports", label: "Sports", emoji: "⚽" },
];

export const products: Product[] = [
  {
    id: "pr1", title: "iPhone 15 Pro — Natural Titanium, 256GB", price: 1150000, originalPrice: 1450000,
    emoji: "📱", gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)", category: "electronics", condition: "Like new",
    location: "Nairobi", distance: "2.1 km", seller: users.amara, rating: 4.9, sales: 34, listed: "2h ago",
    description: "Barely used, always in a case. Box, cable and warranty card included. Selling because I upgraded.",
    watchers: 128, featured: true, escrow: true,
  },
  {
    id: "pr2", title: "Ankara maxi dress — handmade, size M", price: 8500, emoji: "👗",
    gradient: "linear-gradient(135deg,#FF7A6B,#F59E0B)", category: "fashion", condition: "New",
    location: "Lagos", distance: "Cross-border", seller: { ...users.zanele, name: "Adaeze N.", handle: "adaeze.styles", avatarColor: "#EC4899", avatarEmoji: "🧵" }, rating: 4.8, sales: 112, listed: "5h ago",
    description: "6 yards of real Dutch wax, made to measure. Ships nationwide in 48h.",
    watchers: 64, escrow: true,
  },
  {
    id: "pr3", title: "Standing desk + monitor arm combo", price: 78000, originalPrice: 95000,
    emoji: "🖥️", gradient: "linear-gradient(135deg,#00C2D1,#2F6BFF)", category: "home", condition: "Good",
    location: "Accra", distance: "Cross-border", seller: users.kwame, rating: 4.7, sales: 19, listed: "1d ago",
    description: "Solid beech frame, electric height adjust. Minor scratch on one leg — photos attached.",
    watchers: 41,
  },
  {
    id: "pr4", title: "Honda CG 125 — 2022, low mileage", price: 950000,
    emoji: "🛵", gradient: "linear-gradient(135deg,#F59E0B,#FF7A6B)", category: "vehicles", condition: "Good",
    location: "Kano", distance: "Cross-border", seller: users.yusuf, rating: 5.0, sales: 8, listed: "3d ago",
    description: "Serviced monthly, new tyres, logbook ready. Viewing Saturday mornings only.",
    watchers: 210, escrow: true,
  },
  {
    id: "pr5", title: "Figma + Adobe CC — 1 year accounts", price: 15000,
    emoji: "🎨", gradient: "linear-gradient(135deg,#8B5CF6,#EC4899)", category: "digital", condition: "New",
    location: "Online", distance: "Digital", seller: users.amara, rating: 4.6, sales: 57, listed: "6h ago",
    description: "Team invite links, instant delivery. Warranty 30 days. DM before buying.",
    watchers: 88,
  },
  {
    id: "pr6", title: "Shea butter body set — 6 pieces", price: 4200,
    emoji: "🧴", gradient: "linear-gradient(135deg,#10B981,#00C2D1)", category: "beauty", condition: "New",
    location: "Johannesburg", distance: "Cross-border", seller: users.zanele, rating: 4.9, sales: 203, listed: "12h ago",
    description: "Raw unrefined shea from Tamale. Gift wrapping available 🧺",
    watchers: 35, escrow: true,
  },
  {
    id: "pr7", title: "Signed match ball — AFCON qualifier", price: 25000,
    emoji: "⚽", gradient: "linear-gradient(135deg,#FF7A6B,#F59E0B)", category: "sports", condition: "Like new",
    location: "Durban", distance: "Cross-border", seller: users.yusuf, rating: 4.8, sales: 12, listed: "2d ago",
    description: "Match-used ball from the qualifier, signed by 11 players. Certificate included.",
    watchers: 156,
  },
  {
    id: "pr8", title: "Mechanical keyboard — hot-swap, RGB", price: 38000, originalPrice: 52000,
    emoji: "⌨️", gradient: "linear-gradient(135deg,#2F6BFF,#8B5CF6)", category: "electronics", condition: "Like new",
    location: "Nairobi", distance: "0.8 km", seller: users.sipho, rating: 4.7, sales: 23, listed: "4h ago",
    description: "Gasket mount, PBT keycaps, lubed switches. Comes with extras bag.",
    watchers: 52,
  },
];

// ---- Telegram-style: channels, secret chats ----

export interface Channel {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  subscribers: number;
  verified?: boolean;
  description: string;
  postsToday: number;
}

export const channels: Channel[] = [
  { id: "ch1", name: "Nova Official", emoji: "📣", gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)", subscribers: 482000, verified: true, description: "Product news, tips and community highlights.", postsToday: 3 },
  { id: "ch2", name: "Builders of Africa", emoji: "🛠️", gradient: "linear-gradient(135deg,#00C2D1,#2F6BFF)", subscribers: 48200, description: "Ship logs, job posts and weekly AMAs.", postsToday: 7 },
  { id: "ch3", name: "Pulse Live Alerts", emoji: "🎧", gradient: "linear-gradient(135deg,#FF7A6B,#F59E0B)", subscribers: 96400, description: "Never miss a Friday Pulse — reminders + guest announcements.", postsToday: 1 },
];

export const secretChatUser: User = {
  id: "secret1",
  name: "Amara Okafor",
  handle: "amara.codes",
  avatarColor: "#00C2D1",
  avatarEmoji: "👩🏾‍💻",
  bio: "Secret chat · end-to-end encrypted",
};

export const secretMessages: ChatMessage[] = [
  { id: "s1", from: "them", kind: "text", text: "psst — the beta invite codes drop at midnight 👀", time: "22:14", read: true },
  { id: "s2", from: "me", kind: "text", text: "No way!! Save me one 🙏", time: "22:15", read: true },
  { id: "s3", from: "them", kind: "text", text: "Already did. This chat self-destructs in 24h btw 🔒", time: "22:16", read: false },
];

// ---- Instagram-style: highlights, notes, close friends ----

export interface Highlight {
  id: string;
  title: string;
  emoji: string;
  gradient: string;
  count: number;
}

export const highlights: Highlight[] = [
  { id: "h1", title: "Trips", emoji: "✈️", gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)", count: 12 },
  { id: "h2", title: "Food", emoji: "🍲", gradient: "linear-gradient(135deg,#FF7A6B,#F59E0B)", count: 8 },
  { id: "h3", title: "Work", emoji: "💻", gradient: "linear-gradient(135deg,#00C2D1,#8B5CF6)", count: 15 },
  { id: "h4", title: "Crew", emoji: "🦊", gradient: "linear-gradient(135deg,#8B5CF6,#EC4899)", count: 6 },
];

export interface Note {
  id: string;
  user: User;
  text: string;
  gradient: string;
}

export const notes: Note[] = [
  { id: "nt1", user: users.amara, text: "shipping the design system today 🚀", gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)" },
  { id: "nt2", user: users.linah, text: "friday pulse!! be there 🎧", gradient: "linear-gradient(135deg,#FF7A6B,#F59E0B)" },
];

// ---- Saved messages & secret chats ----

export const savedMessagesList: ChatMessage[] = [
  { id: "sv1", from: "me", kind: "text", text: "Nova escrow fee idea: 1.5% under KSh 50k, 1% above", time: "Mon", read: true },
  { id: "sv2", from: "me", kind: "text", text: "Reminder: call accountant re: creator payouts VAT", time: "Tue", read: true },
  { id: "sv3", from: "me", kind: "voice", text: "Voice note · 0:36", time: "Wed", read: true },
  { id: "sv4", from: "me", kind: "text", text: "Gift idea for Amara's birthday 🎁", time: "Thu", read: true },
];

export const secretConversation: Conversation = {
  id: "cvSecret",
  kind: "secret",
  name: "Amara Okafor",
  emoji: "👩🏾‍💻",
  gradient: "linear-gradient(135deg,#00C2D1,#2F6BFF)",
  lastMessage: "Already did. This chat self-destructs in 24h btw 🔒",
  time: "22:16",
  unread: 1,
  online: true,
  secret: true,
};

export const savedConversation: Conversation = {
  id: "cvSaved",
  kind: "saved",
  name: "Saved Messages",
  emoji: "🔖",
  gradient: "linear-gradient(135deg,#2F6BFF,#00C2D1)",
  lastMessage: "Gift idea for Amara's birthday 🎁",
  time: "Thu",
  unread: 0,
};

export const channelConversations: Conversation[] = channels.map((c) => ({
  id: `chan-${c.id}`,
  kind: "channel" as const,
  name: c.name,
  emoji: c.emoji,
  gradient: c.gradient,
  lastMessage: `${c.postsToday} posts today · ${c.subscribers.toLocaleString()} subscribers`,
  time: "now",
  unread: 0,
  subscribers: c.subscribers,
  verified: c.verified,
}));

export const channelPosts: Record<string, { text: string; time: string; views: number }[]> = {
  "chan-ch1": [
    { text: "🚀 Nova 2.0 beta opens Monday — early access for top contributors. Details in the app!", time: "09:00", views: 182340 },
    { text: "New: Marketplace Escrow is live in Nairobi & Lagos. Buy with zero stress 🛡️", time: "11:30", views: 96410 },
    { text: "Community spotlight: @amara.codes shipped Pebble UI kit — go support!", time: "16:45", views: 54120 },
  ],
  "chan-ch2": [
    { text: "Weekly AMA this Friday 5pm WAT — bring your build questions", time: "08:00", views: 12400 },
    { text: "Hiring: 3 junior frontend roles at a Lagos fintech. DMs open.", time: "13:20", views: 8930 },
    { text: "Show & tell thread: post your side project screenshots", time: "17:05", views: 6720 },
  ],
  "chan-ch3": [
    { text: "🎧 FRIDAY PULSE — doors 7pm, rooftop, Nairobi. Guests: DJ Kelvin + 2 more!", time: "10:00", views: 45230 },
  ],
};

