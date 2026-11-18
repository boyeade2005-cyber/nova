import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimited, clearRateLimits, throttle, debounce } from "./rateLimit";

describe("rateLimited", () => {
  beforeEach(() => clearRateLimits());

  it("allows the first call and blocks calls inside the window", () => {
    expect(rateLimited("a", 1000, 0)).toBe(true);
    expect(rateLimited("a", 1000, 500)).toBe(false);
    expect(rateLimited("a", 1000, 999)).toBe(false);
  });

  it("allows again after the window elapses", () => {
    expect(rateLimited("a", 1000, 0)).toBe(true);
    expect(rateLimited("a", 1000, 1000)).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(rateLimited("a", 1000, 0)).toBe(true);
    expect(rateLimited("b", 1000, 0)).toBe(true);
    expect(rateLimited("a", 1000, 1)).toBe(false);
  });

  it("defaults to Date.now", () => {
    expect(rateLimited("t", 60_000)).toBe(true);
    expect(rateLimited("t", 60_000)).toBe(false);
  });
});

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes immediately then suppresses calls within the window", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invokes again after the window", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("forwards arguments", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled("x", 1);
    expect(fn).toHaveBeenCalledWith("x", 1);
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("only invokes after the quiet period with the last args", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced("a");
    vi.advanceTimersByTime(50);
    debounced("b");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
  });

  it("cancel prevents the pending invocation", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});
