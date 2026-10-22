import hrContents from "../data/hr-contents.json";

class HrContentService {
  private contents: string[] = [];

  async initialize(): Promise<void> {
    const contents: unknown = hrContents;
    if (
      !Array.isArray(contents) ||
      contents.length === 0 ||
      !contents.every((content) => typeof content === "string" && content.trim().length > 0)
    ) {
      throw new Error("[HrContentService] hr-contents.json must contain a non-empty array of non-blank strings");
    }
    this.contents = [...contents];
    console.log(`[HrContentService] Initialized with ${this.contents.length} local contents`);
  }

  stop(): void {
    // Static content owns no resources; keep the existing shutdown API compatible.
  }

  getRandomContent(): string | null {
    if (this.contents.length === 0) {
      // silent-ok: 初期化前は抽選不可 / messageCreateの既存No content available警告で判別する
      return null;
    }
    const index = Math.floor(Math.random() * this.contents.length);
    return this.contents[index];
  }
}

export const hrContentService = new HrContentService();
