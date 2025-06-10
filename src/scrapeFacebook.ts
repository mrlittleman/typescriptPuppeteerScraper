import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdBlockerPlugin from 'puppeteer-extra-plugin-adblocker';
import { loginFacebook } from './browser/puppeteer.config';
import { randomDelay } from './utils/fileUtils';
import { getRandomUserAgent } from './config/userAgents';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';
import { format } from 'date-fns';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());
puppeteer.use(AdBlockerPlugin());

const keywords = ["Registrar", "Clearance", "Enrollment", "Department"];
const CSV_FILE_PATH = path.resolve(__dirname, '..', 'results.csv');
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');

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

function parseFbDate(dateText: string): Date | null {
  try {
    const now = new Date();

    if (/ago/i.test(dateText)) {
      const [numStr, unit] = dateText.split(' ').slice(0, 2);
      const num = parseInt(numStr);
      if (unit.startsWith('hr')) return new Date(now.getTime() - num * 60 * 60 * 1000);
      if (unit.startsWith('min')) return new Date(now.getTime() - num * 60 * 1000);
      if (unit.startsWith('day')) return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
    }

    if (/Yesterday/i.test(dateText)) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {
    return null;
  }
  return null;
}

async function loadExistingData(): Promise<Set<string>> {
  if (!fs.existsSync(CSV_FILE_PATH)) return new Set();
  const content = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
  const lines = content.split('\n').slice(1);
  const texts = lines
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      const firstCommaIndex = line.indexOf(',');
      if (firstCommaIndex === -1) return '';
      return line.slice(0, firstCommaIndex);
    });
  return new Set(texts);
}

async function scrapeAndSave() {
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
      width: 1280 + Math.floor(Math.random() * 100),
      height: 720 + Math.floor(Math.random() * 100),
    });

    await page.goto('https://www.facebook.com', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await randomDelay(2000, 4000);

    await page.evaluate(async () => {
      window.scrollBy(0, window.innerHeight);
      await new Promise(r => setTimeout(r, 2000));
    });

    const posts = await page.evaluate((keywords) => {
      const lowerKeywords = keywords.map(k => k.toLowerCase());
      const postSelector = '[role="article"]';

      const postNodes = Array.from(document.querySelectorAll(postSelector));

      return postNodes.map(post => {
        const postEl = post as HTMLElement;
        const text = postEl.innerText || '';

        const textLower = text.toLowerCase();

        const matchedKeyword = lowerKeywords.find(k => textLower.includes(k));
        if (!matchedKeyword) return null;

        const dateEl = post.querySelector('abbr') as HTMLElement | null;
        const dateText = dateEl?.getAttribute('title') || dateEl?.innerText || '';

        const linkEl = post.querySelector('a[href*="/posts/"], a[href*="/permalink/"]') as HTMLAnchorElement | null;
        const url = linkEl?.href || '';

        return { text: text.trim(), dateText, url, keyword: matchedKeyword };
      }).filter(Boolean);
    }, keywords);

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const filteredPosts = posts
      .map(({ text, dateText, url, keyword }) => ({
        text,
        date: parseFbDate(dateText) || new Date(0),
        url,
        keyword,
      }))
      .filter(post => post.date >= twoYearsAgo && post.text.length > 0);

    const newPosts = filteredPosts.filter(post => !existingTexts.has(post.text));

    if (newPosts.length === 0) {
      console.log('No new posts found within last 2 years.');
      return;
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
            path: screenshotPath,
            clip: {
              x: Math.max(clip.x, 0),
              y: Math.max(clip.y, 0),
              width: Math.min(clip.width, page.viewport()?.width || 1280),
              height: Math.min(clip.height, page.viewport()?.height || 720),
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

    // Append capturedDate to all records
    const newPostsWithCaptureDate = newPosts.map(post => ({
      text: post.text,
      date: post.date.toISOString(),
      url: post.url,
      screenshot: post.screenshot,
      keyword: post.keyword,
      capturedDate: now.toISOString(),
    }));

    await csvWriter.writeRecords(newPostsWithCaptureDate);
    console.log(`Saved ${newPostsWithCaptureDate.length} new posts to CSV.`);
  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    if (browser) await browser.close();
  }
}

(async () => {
  await scrapeAndSave();

  setInterval(async () => {
    console.log('Starting scheduled scrape...');
    await scrapeAndSave();
  }, 30 * 60 * 1000);
})();
