import { scrapeAndSave } from './services/scrapePosts';
import dotenv from 'dotenv';

dotenv.config();

console.log('Setting up scheduled scraping...');

const runScraping = async () => {
  console.log('Scheduled scraping in progress...');
  await scrapeAndSave();
};

// Call it explicitly later
runScraping();
// , 30 * 60 * 1000