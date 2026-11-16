import { BadgeCheck } from "lucide-react";
import type { User } from "../data/mock";

export function Avatar({
  user,
  size = 40,
  ring = false,
  story = false,
}: {
  user: User;
  size?: number;
  ring?: boolean;
  story?: boolean;
}) {
  const inner = (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold select-none shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        background: story
          ? `linear-gradient(135deg,#2F6BFF,#00C2D1,#FF7A6B)`
          : user.avatarColor,
        padding: story ? 3 : 0,
      }}
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{ background: story ? "var(--surface)" : undefined }}
      >
        <span style={story ? { color: "#2F6BFF", fontSize: size * 0.42 } : undefined}>
          {user.avatarEmoji}
        </span>
      </div>
    </div>
  );

  if (!ring) return inner;
  return <div style={{ padding: 3 }}>{inner}</div>;
}

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <BadgeCheck
      size={size}
      className="inline-block shrink-0"
      style={{ color: "#2F6BFF" }}
      fill="currentColor"
    />
  );
}
