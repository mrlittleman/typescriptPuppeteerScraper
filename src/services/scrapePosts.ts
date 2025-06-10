import { scrapePosts } from '../services/scraper';
import { KEYWORDS } from '../constants/keywords';

export async function scrapeAndSave(): Promise<void> {
  const group = 'tfwmanilaqc';
  if (!group) {
    throw new Error('FB_GROUP environment variable not set');
  }

  await scrapePosts({
    keywords: KEYWORDS,
    groupId: group
  });
}