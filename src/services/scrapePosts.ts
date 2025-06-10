import { scrapePosts } from '../services/scraper';
import { KEYWORDS } from '../constants/keywords';

export async function scrapeAndSave(): Promise<void> {
  console.log(process.env.FB_GROUP);
  if (!process.env.FB_GROUP) {
    throw new Error('FB_GROUP environment variable not set');
  }

  await scrapePosts({
    keywords: KEYWORDS,
    groupId: process.env.FB_GROUP
  });
}