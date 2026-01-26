import { HrApiResponse } from "../types/api";

const HR_API_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLjCg0RJTkAKMMuwTyQSt1zIYs03vVYpqjGC31ElFgA8w6inYmyiEzZQmdfN_XOMpQj7zHIx6zG_-FoWkZojFQ9A8TWGBdY35AM0Dh1xLgyd4-CR73tWB06y74kDmetXd08qGQfVZOWOZSYLszpjgmE6wRGKv0wYnrzi1apnf7BZDKojXb1qLZNmIzGCh92Bge0q4XPy3PLoH47zzyiI3T4w1TWVLbLaeNqpXu5nV1kBDoQNUSugrHpVtXmfLagVZ66p7ab_jH7ycwaRO-3LPEcmyO0X0Q&lib=M6TxFyLvMO3bIO7aCRiswAgrpsbzMODYD";
const CACHE_UPDATE_INTERVAL_MS = 60 * 1000; // 1分

class HrContentService {
  private contents: string[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * サービスを初期化し、バックグラウンド更新を開始
   */
  async initialize(): Promise<void> {
    await this.fetchContents();
    this.startBackgroundUpdate();
    console.log("[HrContentService] Initialized with background updates");
  }

  /**
   * バックグラウンド更新を停止
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[HrContentService] Stopped background updates");
    }
  }

  /**
   * ランダムなコンテンツを取得
   */
  getRandomContent(): string | null {
    if (this.contents.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * this.contents.length);
    return this.contents[index];
  }

  /**
   * APIからコンテンツを取得
   */
  private async fetchContents(): Promise<void> {
    try {
      const response = await fetch(HR_API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = (await response.json()) as HrApiResponse;
      this.contents = data.contents;
      console.log(
        `[HrContentService] Fetched ${this.contents.length} contents (updatedAt: ${data.updatedAt})`
      );
    } catch (error) {
      console.error("[HrContentService] Failed to fetch contents:", error);
      // キャッシュがある場合は維持、ない場合はフォールバック
      if (this.contents.length === 0) {
        this.contents = ["APIからの取得に失敗しました"];
      }
    }
  }

  /**
   * バックグラウンド更新を開始
   */
  private startBackgroundUpdate(): void {
    this.intervalId = setInterval(async () => {
      await this.fetchContents();
    }, CACHE_UPDATE_INTERVAL_MS);
  }
}

export const hrContentService = new HrContentService();
