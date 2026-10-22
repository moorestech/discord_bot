import { afterEach, describe, expect, it, vi } from "vitest";

// Reload the singleton for each case so initialization state cannot leak.
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.doUnmock("../../data/hr-contents.json");
  vi.resetModules();
});

describe("hrContentService", () => {
  it("initializes and draws without network access or periodic updates", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    const { hrContentService } = await import("../hrContentService");
    await hrContentService.initialize();
    hrContentService.stop();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(hrContentService.getRandomContent()).not.toBe("APIからの取得に失敗しました");
  });
});
