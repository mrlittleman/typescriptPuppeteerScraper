import { scrapeFacebook } from './scraper/facebookScraper';

(async () => {
  await scrapeFacebook();

  setInterval(async () => {
    console.log('Scheduled scrape running...');
    await scrapeFacebook();
  }, 30 * 60 * 1000);
})();