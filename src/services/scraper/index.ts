import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdBlockerPlugin from 'puppeteer-extra-plugin-adblocker';
import { randomDelay } from '../../utils/fileUtils';
import { getRandomUserAgent } from '../../config/userAgents';
import { parseFbDate } from '../../utils/dateParser';
import { saveLastScrapeTimestamp, loadLastScrapeTimestamp } from '../../utils/timestampHandler';
import { loginFacebook } from '../../browser/puppeteer.config';
import { uploadScreenshot, savePostToFirestore } from '../../services/firebaseService';
import { Post, ScrapeConfig } from '../../types/post';

puppeteer.use(StealthPlugin());
puppeteer.use(AdBlockerPlugin());

export async function scrapePosts(config: ScrapeConfig): Promise<void> {
  let browser;
  const { keywords, groupId } = config;

  try {
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

    await page.goto(`https://www.facebook.com/groups/${groupId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await randomDelay(2000, 4000);
    const lastScrapeTimestamp = await loadLastScrapeTimestamp();

    for (const keyword of keywords) {
      const keywordVariants = generateKeywordVariants(keyword);
      console.log(`Searching posts for keyword variants: ${keywordVariants.join(', ')}`);

      const foundPost: any = await findPost(page, keywordVariants, lastScrapeTimestamp);
      
      if (!foundPost) {
        console.log(`No new post found for keyword: ${keyword}`);
        continue;
      }

      const screenshotUrl = await captureAndUploadScreenshot(page, foundPost.text);
      
      const postToSave: Post = {
        text: foundPost.text,
        dateText: foundPost.dateText,
        url: foundPost.url,
        screenshotUrl,
        keyword: foundPost.keyword,
        capturedDate: new Date().toISOString(),
        groupId
      };

      await savePostToFirestore(postToSave);
      console.log(`Saved post for keyword "${keyword}" to Firebase.`);
      await saveLastScrapeTimestamp(foundPost.dateText);
    }
  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    if (browser) await browser.close();
  }
}

function generateKeywordVariants(keyword: string): string[] {
  return [
    keyword,
    keyword.toUpperCase(),
    keyword.toLowerCase(),
    keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase()
  ];
}

async function findPost(page: any, keywordVariants: string[], lastScrapeTimestamp: Date | null): Promise<Partial<Post> | null> {
  let hasMorePosts = true;
  
  while (hasMorePosts) {
    const post = await page.evaluate((variants: any[]) => {
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

          return { text: text.trim(), dateText, url, keyword: variants[0] };
        }
      }
      return null;
    }, keywordVariants);

    if (post) {
      const parsedDate = parseFbDate(post.dateText) || new Date();
      if (post.text.length > 0 && (!lastScrapeTimestamp || parsedDate > lastScrapeTimestamp)) {
        return { ...post, dateText: parsedDate.toISOString() };
      }
    }

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await randomDelay(3000, 5000);

    hasMorePosts = await page.evaluate(() => {
      return document.querySelectorAll('[role="article"]').length > 0;
    });
  }
  
  return null;
}

async function captureAndUploadScreenshot(page: any, postText: string): Promise<string> {
  try {
    await page.evaluate((text: string) => {
      const el = Array.from(document.querySelectorAll('[role="article"]'))
        .find(e => (e as HTMLElement).innerText.includes(text));
      if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, postText);

    await randomDelay(1500, 2000);

    const clip = await page.evaluate((text: string) => {
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
    }, postText);

    if (clip) {
      const screenshotBuffer = await page.screenshot({
        clip,
        encoding: 'binary',
      });

      return await uploadScreenshot(screenshotBuffer, `post_${Date.now()}`);
    }
  } catch (e) {
    console.warn('Screenshot capture failed:', e);
  }
  return '';
}