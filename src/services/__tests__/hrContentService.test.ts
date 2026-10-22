import contents from "../../data/hr-contents.json";
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
    expect(contents).toHaveLength(96);
    expect(contents).toContain(hrContentService.getRandomContent());
  });

  it.each([
    ["empty array", []],
    ["non-array", {}],
    ["null", null],
    ["non-string entry", ["valid", 42]],
    ["empty entry", [""]],
    ["blank entry", [" \t\n"]],
  ])("rejects %s during initialization", async (_label, invalidContents) => {
    vi.doMock("../../data/hr-contents.json", () => ({ default: invalidContents }));
    const { hrContentService } = await import("../hrContentService");
    await expect(hrContentService.initialize()).rejects.toThrow("hr-contents.json");
  });

  it("preserves exact text and draws the first and last entries", async () => {
    const entries = ["  first  ", "last\n"];
    vi.doMock("../../data/hr-contents.json", () => ({ default: entries }));
    const { hrContentService } = await import("../hrContentService");
    await hrContentService.initialize();
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(hrContentService.getRandomContent()).toBe(entries[0]);
    random.mockReturnValue(1 - Number.EPSILON);
    expect(hrContentService.getRandomContent()).toBe(entries[1]);
  });

  it("can initialize again after repeated stop calls", async () => {
    const { hrContentService } = await import("../hrContentService");
    hrContentService.stop();
    await hrContentService.initialize();
    hrContentService.stop();
    hrContentService.stop();
    await hrContentService.initialize();
    expect(contents).toContain(hrContentService.getRandomContent());
  });
});
