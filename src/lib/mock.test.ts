import { describe, it, expect } from "vitest";
import { makeLocalPost, makePost, currentUser, users } from "../data/mock";

describe("makeLocalPost", () => {
  it("builds a post shell attributed to the given user", () => {
    const post = makeLocalPost(currentUser, "hello world", "p-123");
    expect(post.id).toBe("p-123");
    expect(post.author).toBe(currentUser);
    expect(post.text).toBe("hello world");
    expect(post.time).toBe("now");
  });

  it("initializes empty engagement state", () => {
    const post = makeLocalPost(users.amara, "hi", "p-1");
    expect(post.reactions).toEqual({ like: 0, love: 0, laugh: 0, wow: 0, support: 0 });
    expect(post.comments).toEqual([]);
    expect(post.shares).toBe(0);
    expect(post.saves).toBe(0);
    expect(post.myReaction).toBeNull();
    expect(post.whySeeing).toBe("You just posted this");
  });

  it("attaches media when provided", () => {
    const media = [{ kind: "photo" as const, gradient: "g", emoji: "🖼️" }];
    const post = makeLocalPost(currentUser, "with media", "p-2", media);
    expect(post.media).toBe(media);
  });

  it("leaves media undefined when omitted", () => {
    const post = makeLocalPost(currentUser, "plain", "p-3");
    expect(post.media).toBeUndefined();
  });
});

describe("makePost", () => {
  it("builds a local post for the current user", () => {
    const post = makePost("draft");
    expect(post.author).toBe(currentUser);
    expect(post.text).toBe("draft");
    expect(post.id).toMatch(/^p\d+$/);
    expect(post.time).toBe("now");
    expect(post.reactions.like).toBe(0);
  });
});
