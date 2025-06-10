import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdBlockerPlugin from 'puppeteer-extra-plugin-adblocker';
import { randomDelay } from '../utils/fileUtils';
import { getRandomUserAgent } from '../config/userAgents';
import { parseFbDate } from '../utils/dateParser';
import { KEYWORDS } from '../constants/keywords';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';
import { format } from 'date-fns';
import { saveLastScrapeTimestamp, loadLastScrapeTimestamp } from '../utils/timestampHandler';
import { loginFacebook } from '../browser/puppeteer.config';

puppeteer.use(StealthPlugin());
puppeteer.use(AdBlockerPlugin());

const CSV_FILE_PATH = path.resolve(__dirname, '../../results.csv');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR);
}

const csvWriter = createObjectCsvWriter({
  path: CSV_FILE_PATH,
  header: [
    { id: 'text', title: 'Text' },
    { id: 'date', title: 'Date' },
    { id: 'url', title: 'URL' },
    { id: 'screenshot', title: 'ScreenshotFilename' },
    { id: 'keyword', title: 'Keyword' },
    { id: 'capturedDate', title: 'CapturedDate' },
  ],
  append: fs.existsSync(CSV_FILE_PATH),
});

async function loadExistingData(): Promise<Set<string>> {
  if (!fs.existsSync(CSV_FILE_PATH)) return new Set();
  const content = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
  const lines = content.split('\n').slice(1);
  const texts = lines
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      const firstCommaIndex = line.indexOf(',');
      return firstCommaIndex === -1 ? '' : line.slice(0, firstCommaIndex);
    });
  return new Set(texts);
}

interface Post {
  text: string;
  dateText: string;
  url: string;
  keyword: string;
  screenshot: string;
}

export async function scrapeAndSave(): Promise<void> {
  let browser;

  try {
    const existingTexts = await loadExistingData();
    const email = process.env.FB_EMAIL;
    const password = process.env.FB_PASSWORD;

    if (!email || !password) {
      throw new Error('Missing FB_EMAIL or FB_PASSWORD in .env file');
    }
    const browser = await loginFacebook(email, password);
    
    const page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());
    await page.setViewport({
      width: 1280 + Math.floor(Math.random() * 100),
      height: 720 + Math.floor(Math.random() * 100),
    });

    await page.goto('https://www.facebook.com/groups/tfwmanilaqc', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await randomDelay(2000, 4000);
    
    const lastScrapeTimestamp = await loadLastScrapeTimestamp();

    // Loop through each keyword and scrape posts
    for (const keyword of KEYWORDS) {
      console.log(`Scraping posts for keyword: ${keyword}`);

      // Collect posts containing the keyword
      const allPosts: Post[] = [];
      let hasMorePosts = true;

      while (hasMorePosts) {
        const posts: Post[] = await page.evaluate((keyword) => {
          const lowerKeyword = keyword.toLowerCase();
          const postSelector = '[role="article"]';
          
          const postNodes = Array.from(document.querySelectorAll(postSelector));
          return postNodes.map(post => {
            const postEl = post as HTMLElement;
            const text = postEl.innerText || '';

            const textLower = text.toLowerCase();
            if (!textLower.includes(lowerKeyword)) return null;

            const dateEl = post.querySelector('abbr') as HTMLElement | null;
            const dateText = dateEl?.getAttribute('title') || dateEl?.innerText || '';

            const linkEl = post.querySelector('a[href*="/posts/"], a[href*="/permalink/"]') as HTMLAnchorElement | null;
            const url = linkEl?.href || '';

            return { text: text.trim(), dateText, url, keyword, screenshot: '' } as Post;
          }).filter((post): post is Post => post !== null);
        }, keyword);

        allPosts.push(...posts);

        // Scroll down and wait for more posts to load
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await randomDelay(3000, 5000);

        // Check if more posts exist
        const newPosts = await page.evaluate(() => {
          const postSelector = '[role="article"]';
          const postNodes = document.querySelectorAll(postSelector);
          return postNodes.length > 0;
        });

        hasMorePosts = newPosts;
      }

      const filteredPosts = allPosts
        .map(({ text, dateText, url, keyword }) => ({
          text,
          date: parseFbDate(dateText) || new Date(0),
          url,
          keyword,
          screenshot: '', 
        }))
        .filter(post => {
          if (lastScrapeTimestamp) {
            return post.date > lastScrapeTimestamp && post.text.length > 0;
          }
          return post.text.length > 0; 
        });

      const newPosts = filteredPosts.filter(post => !existingTexts.has(post.text));
      if (newPosts.length === 0) {
        console.log(`No new posts found for keyword: ${keyword}`);
        continue; // Proceed to the next keyword
      }

      const now = new Date();

      for (let i = 0; i < newPosts.length; i++) {
        const post = newPosts[i];
        try {
          await page.evaluate(text => {
            const el = Array.from(document.querySelectorAll('[role="article"]'))
              .find(e => (e as HTMLElement).innerText.includes(text));
            if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, post.text);

          await randomDelay(1500, 2000);

          const clip = await page.evaluate(text => {
            const el = Array.from(document.querySelectorAll('[role="article"]'))
              .find(e => (e as HTMLElement).innerText.includes(text));
            if (!el) return null;
            const rect = (el as HTMLElement).getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
          }, post.text);

          if (clip) {
            const dateFolderName = format(post.date, 'yyyy-MM-dd');
            const folderPath = path.resolve(SCREENSHOTS_DIR, dateFolderName);
            await fsExtra.ensureDir(folderPath);

            const screenshotFileName = `post_${Date.now()}_${i}.png`;
            const screenshotPath = path.resolve(folderPath, screenshotFileName);
            
            await page.screenshot({
              path: `${screenshotPath}.png`,  
              clip: {
                x: Math.max(clip.x, 0),
                y: Math.max(clip.y, 0),
                width: Math.min(clip.width, page.viewport()?.width || 2560),
                height: Math.min(clip.height, page.viewport()?.height || 1440),
              },
            });
            
            post.screenshot = screenshotPath; 
          } else {
            post.screenshot = '';
          }
        } catch (e) {
          console.warn('Screenshot failed for post:', post.text);
          post.screenshot = '';
        }
      }

      const newPostsWithCaptureDate = newPosts.map(post => ({
        text: post.text,
        date: post.date.toISOString(),
        url: post.url,
        screenshot: post.screenshot,
        keyword: post.keyword,
        capturedDate: now.toISOString(),
      }));

      await csvWriter.writeRecords(newPostsWithCaptureDate);
      console.log(`Saved ${newPostsWithCaptureDate.length} new posts for keyword "${keyword}" to CSV.`);

      const mostRecentPost = newPosts.reduce((latest, post) => {
        return post.date > latest.date ? post : latest;
      }, newPosts[0]);
      await saveLastScrapeTimestamp(mostRecentPost.date.toISOString());
    }

  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    if (browser) await browser.close();
  }
}
