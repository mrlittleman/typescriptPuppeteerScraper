export interface Post {
  id?: string;
  text?: string;
  dateText?: string;
  url?: string;
  screenshotUrl?: string;
  keyword?: string;
  capturedDate?: string;
  groupId?: string;
}

export interface ScrapeConfig {
  keywords: string[];
  groupId: string;
}