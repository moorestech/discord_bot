import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("checkAndSend integration", () => {
  it("sends message when schedule is due", async () => {
    // Dynamic import to get the class instance fresh for mocking
    const { scheduledMessageService, shouldSendNow: _shouldSendNow } = await import(
      "../scheduledMessageService"
    );

    const mockSend = vi.fn().mockResolvedValue(undefined);
    const mockChannel = {
      isTextBased: () => true,
      send: mockSend,
    };

    const mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue(mockChannel),
      },
    } as any;

    // Write a temp YAML config
    const tmpDir = path.join(__dirname, "tmp-integration");
    fs.mkdirSync(tmpDir, { recursive: true });

    const now = new Date();
    const yamlContent = `schedules:
  - channel_id: "111222333"
    start: "${now.toISOString()}"
    interval: "1h"
    message: "Test message"
`;
    const configPath = path.join(tmpDir, "scheduled-messages.yaml");
    fs.writeFileSync(configPath, yamlContent);

    // Mock process.cwd to point to our temp dir
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      // We need a fresh instance, so we manually call initialize which sets up the config
      scheduledMessageService.initialize(mockClient);
      // The initialize call also triggers checkAndSend, wait for it
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockClient.channels.fetch).toHaveBeenCalledWith("111222333");
      expect(mockSend).toHaveBeenCalledWith({
        content: "Test message",
        allowedMentions: { parse: ["roles"] },
      });
    } finally {
      scheduledMessageService.stop();
      process.cwd = originalCwd;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not crash when channel is not found", async () => {
    const { scheduledMessageService } = await import("../scheduledMessageService");

    const mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const tmpDir = path.join(__dirname, "tmp-integration-2");
    fs.mkdirSync(tmpDir, { recursive: true });

    const now = new Date();
    const yamlContent = `schedules:
  - channel_id: "999999999"
    start: "${now.toISOString()}"
    interval: "1h"
    message: "Test"
`;
    const configPath = path.join(tmpDir, "scheduled-messages.yaml");
    fs.writeFileSync(configPath, yamlContent);

    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      scheduledMessageService.initialize(mockClient);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not throw, just log error
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      scheduledMessageService.stop();
      process.cwd = originalCwd;
      consoleSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
