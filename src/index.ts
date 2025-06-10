import { scrapeAndSave } from './services/scrapePosts';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  await scrapeAndSave();

  setInterval(async () => {
    console.log('Scheduled scraping in progress...');
    await scrapeAndSave();
  }, 30 * 60 * 1000);
})();
