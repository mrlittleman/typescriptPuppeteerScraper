import { scrapeAndSave } from './services/scrapePosts';
import dotenv from 'dotenv';

dotenv.config();

console.log('Setting up scheduled scraping...');
setInterval(async () => {
  console.log('Scheduled scraping in progress...');
  await scrapeAndSave();
}, 30 * 60 * 1000);