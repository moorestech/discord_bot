import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  parseInterval,
  shouldSendNow,
  loadScheduleConfig,
} from "../scheduledMessageService";

// --- parseInterval ---

describe("parseInterval", () => {
  it("parses minutes", () => {
    expect(parseInterval("30m")).toBe(30 * 60 * 1000);
  });

  it("parses hours", () => {
    expect(parseInterval("2h")).toBe(2 * 60 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseInterval("1d")).toBe(24 * 60 * 60 * 1000);
  });

  it("parses 7 days", () => {
    expect(parseInterval("7d")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("throws on invalid string 'abc'", () => {
    expect(() => parseInterval("abc")).toThrow('Invalid interval format: "abc"');
  });

  it("throws on empty string", () => {
    expect(() => parseInterval("")).toThrow('Invalid interval format: ""');
  });

  it("throws on invalid unit '10x'", () => {
    expect(() => parseInterval("10x")).toThrow('Invalid interval format: "10x"');
  });
});

// --- shouldSendNow ---

describe("shouldSendNow", () => {
  const ONE_HOUR = 60 * 60 * 1000;

  it("returns true at start time", () => {
    const start = new Date("2025-01-01T09:00:00+09:00");
    const now = new Date("2025-01-01T09:00:00+09:00");
    expect(shouldSendNow(start, ONE_HOUR, now, null)).toBe(true);
  });

  it("returns true at start + interval", () => {
    const start = new Date("2025-01-01T09:00:00+09:00");
    const now = new Date("2025-01-01T10:00:00+09:00");
    expect(shouldSendNow(start, ONE_HOUR, now, null)).toBe(true);
  });

  it("returns false at halfway through interval", () => {
    const start = new Date("2025-01-01T09:00:00+09:00");
    const now = new Date("2025-01-01T09:30:00+09:00");
    expect(shouldSendNow(start, ONE_HOUR, now, null)).toBe(false);
  });

  it("returns false when start is in the future", () => {
    const start = new Date("2025-06-01T09:00:00+09:00");
    const now = new Date("2025-01-01T09:00:00+09:00");
    expect(shouldSendNow(start, ONE_HOUR, now, null)).toBe(false);
  });

  it("returns false when already sent in the same window", () => {
    const start = new Date("2025-01-01T09:00:00+09:00");
    const now = new Date("2025-01-01T10:00:30+09:00");
    const lastSent = new Date("2025-01-01T10:00:00+09:00");
    expect(shouldSendNow(start, ONE_HOUR, now, lastSent)).toBe(false);
  });

  it("returns true when lastSent was a full interval ago", () => {
    const start = new Date("2025-01-01T09:00:00+09:00");
    const now = new Date("2025-01-01T11:00:00+09:00");
    const lastSent = new Date("2025-01-01T10:00:00+09:00");
    expect(shouldSendNow(start, ONE_HOUR, now, lastSent)).toBe(true);
  });

  it("returns true slightly after schedule time within 1-minute window", () => {
    const start = new Date("2025-01-01T09:00:00+09:00");
    const now = new Date("2025-01-01T09:00:30+09:00"); // 30 seconds after
    expect(shouldSendNow(start, ONE_HOUR, now, null)).toBe(true);
  });

  it("returns false just outside 1-minute window", () => {
    const start = new Date("2025-01-01T09:00:00+09:00");
    const now = new Date("2025-01-01T09:01:01+09:00"); // 61 seconds after
    expect(shouldSendNow(start, ONE_HOUR, now, null)).toBe(false);
  });
});

// --- loadScheduleConfig ---

describe("loadScheduleConfig", () => {
  const tmpDir = path.join(__dirname, "tmp-test");

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses valid YAML config", () => {
    const yamlContent = `schedules:
  - channel_id: "123"
    start: "2025-01-01T09:00:00+09:00"
    interval: "1h"
    message: "Hello!"
`;
    const filePath = path.join(tmpDir, "test.yaml");
    fs.writeFileSync(filePath, yamlContent);

    const config = loadScheduleConfig(filePath);
    expect(config.schedules).toHaveLength(1);
    expect(config.schedules[0].channel_id).toBe("123");
    expect(config.schedules[0].interval).toBe("1h");
    expect(config.schedules[0].message).toBe("Hello!");
  });

  it("handles empty schedules array", () => {
    const yamlContent = `schedules: []\n`;
    const filePath = path.join(tmpDir, "empty.yaml");
    fs.writeFileSync(filePath, yamlContent);

    const config = loadScheduleConfig(filePath);
    expect(config.schedules).toHaveLength(0);
  });

  it("returns empty schedules when file does not exist", () => {
    const config = loadScheduleConfig(path.join(tmpDir, "nonexistent.yaml"));
    expect(config.schedules).toHaveLength(0);
  });

  it("handles YAML with no schedules key", () => {
    const yamlContent = `other_key: value\n`;
    const filePath = path.join(tmpDir, "no-schedules.yaml");
    fs.writeFileSync(filePath, yamlContent);

    const config = loadScheduleConfig(filePath);
    expect(config.schedules).toHaveLength(0);
  });

  it("parses multiline message", () => {
    const yamlContent = `schedules:
  - channel_id: "456"
    start: "2025-01-01T12:00:00+09:00"
    interval: "7d"
    message: |
      Line 1
      Line 2
`;
    const filePath = path.join(tmpDir, "multiline.yaml");
    fs.writeFileSync(filePath, yamlContent);

    const config = loadScheduleConfig(filePath);
    expect(config.schedules[0].message).toContain("Line 1");
    expect(config.schedules[0].message).toContain("Line 2");
  });
});
