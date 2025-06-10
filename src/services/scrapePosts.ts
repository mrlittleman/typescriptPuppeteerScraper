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

function generateKeywordVariants(keyword: string): string[] {
  return [
    keyword,
    keyword.toUpperCase(),
    keyword.toLowerCase(),
    keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase()
  ];
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

    browser = await loginFacebook(email, password);
    const page = await browser.newPage();
    await page.setUserAgent(getRandomUserAgent());
    await page.setViewport({
      width: 1920 + Math.floor(Math.random() * 100),
      height: 1080 + Math.floor(Math.random() * 100),
    });

    await page.goto(`https://www.facebook.com/groups/${process.env.FB_Group}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await randomDelay(2000, 4000);
    const lastScrapeTimestamp = await loadLastScrapeTimestamp();

    for (const keyword of KEYWORDS) {
      const keywordVariants = generateKeywordVariants(keyword);
      console.log(`Searching posts for keyword variants: ${keywordVariants.join(', ')}`);

      let foundPost: Post | null = null;

      let hasMorePosts = true;
      while (hasMorePosts && !foundPost) {
        const post = await page.evaluate((variants) => {
          const postSelector = '[role="article"]';
          const postNodes = Array.from(document.querySelectorAll(postSelector));

          for (const node of postNodes) {
            const postEl = node as HTMLElement;
            const text = postEl.innerText || '';

            if (variants.some(v => text.includes(v))) {
              const dateEl = postEl.querySelector('abbr');
              const dateText = dateEl?.getAttribute('title') || '';

              const linkEl = postEl.querySelector('a[href*="/posts/"], a[href*="/permalink/"]') as HTMLAnchorElement | null;
              const url = linkEl?.href || '';

              return { text: text.trim(), dateText, url, keyword: variants[0], screenshot: '' } as Post;
            }
          }

          return null;
        }, keywordVariants);

        if (post) {
          const parsedDate = parseFbDate(post.dateText) || new Date();
          if (post.text.length > 0 && !existingTexts.has(post.text) && (!lastScrapeTimestamp || parsedDate > lastScrapeTimestamp)) {
            foundPost = { ...post, dateText: parsedDate.toISOString() };
            break;
          }
        }

        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await randomDelay(3000, 5000);

        hasMorePosts = await page.evaluate(() => {
          return document.querySelectorAll('[role="article"]').length > 0;
        });
      }

      if (!foundPost) {
        console.log(`No new post found for keyword: ${keyword}`);
        continue;
      }

      const now = new Date();

      try {
        await page.evaluate(text => {
          const el = Array.from(document.querySelectorAll('[role="article"]'))
            .find(e => (e as HTMLElement).innerText.includes(text));
          if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, foundPost.text);

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
        }, foundPost.text);

        if (clip) {
          const dateFolder = format(new Date(foundPost.dateText), 'yyyy-MM-dd');
          const folderPath = path.resolve(SCREENSHOTS_DIR, dateFolder);
          await fsExtra.ensureDir(folderPath);

          const screenshotName = `post_${Date.now()}.png`;
          const screenshotPath = path.resolve(folderPath, screenshotName);

          await page.screenshot({
            path: `${screenshotPath}.png`,
            fullPage: false,
          });

          foundPost.screenshot = screenshotPath;
        }
      } catch (e) {
        console.warn('Screenshot capture failed:', e);
        foundPost.screenshot = '';
      }

      const finalPost = {
        text: foundPost.text,
        date: foundPost.dateText,
        url: foundPost.url,
        screenshot: foundPost.screenshot,
        keyword: foundPost.keyword,
        capturedDate: now.toISOString(),
      };

      await csvWriter.writeRecords([finalPost]);
      console.log(`Saved post for keyword "${keyword}" and captured screenshot.`);
      await saveLastScrapeTimestamp(foundPost.dateText);
    }

  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    if (browser) await browser.close();
  }
}