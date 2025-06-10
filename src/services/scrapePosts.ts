import { scrapePosts } from '../services/scraper';
import { KEYWORDS } from '../constants/keywords';

export async function scrapeAndSave(): Promise<void> {
  if (!process.env.FB_GROUP) {
    throw new Error('FB_GROUP environment variable not set');
  }

  await scrapePosts({
    keywords: KEYWORDS,
    groupId: process.env.FB_GROUP
  });
}