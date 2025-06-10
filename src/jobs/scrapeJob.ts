import { FB_EMAIL, FB_PASSWORD } from '../config/env';
import { KEYWORDS, SCREENSHOTS_DIR } from '../constants';
import { loadExistingData, getCsvWriter } from '../services/csv';
import { parseFbDate } from '../services/dateParser';
import { getBrowser } from '../services/browser';
import { ensureDirExists } from '../utils/file';
import { randomDelay } from '../utils/delay';
import { getRandomUserAgent } from '../config/userAgent';
import { log } from '../utils/logger';
import path from 'path';
import { format } from 'date-fns';
import fsExtra from 'fs-extra';

export async function runScrapeJob() {
    let browser;

    try {
        const existing = await loadExistingData();
        browser = await getBrowser(FB_EMAIL!, FB_PASSWORD!);
        const page = await browser.newPage();

        await page.setUserAgent(getRandomUserAgent());
        await page.setViewport({ width: 1300, height: 800 });

        await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await randomDelay(2000, 3000);

        // Scrape posts from DOM
        const posts = await page.evaluate((keywords) => {
            const lowerKeywords = keywords.map(k => k.toLowerCase());
            const postNodes = Array.from(document.querySelectorAll('[role="article"]'));

            return postNodes.map(post => {
                const text = (post as HTMLElement).innerText || '';
                const textLower = text.toLowerCase();
                const keyword = lowerKeywords.find(k => textLower.includes(k));
                if (!keyword) return null;

                const dateEl = post.querySelector('abbr');
                const dateText = dateEl?.getAttribute('title') || dateEl?.textContent || '';
                const linkEl = post.querySelector('a[href*="/posts/"], a[href*="/permalink/"]');
                const url = (linkEl as HTMLAnchorElement)?.href || '';

                return { text, dateText, url, keyword };
            }).filter(Boolean);
        }, KEYWORDS);

        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const newPosts = posts
            .map(p => ({
                text: p.text.trim(),
                date: parseFbDate(p.dateText) || new Date(0),
                url: p.url,
                keyword: p.keyword,
            }))
            .filter(p => p.date >= twoYearsAgo && !existing.has(p.text));

        const now = new Date();

        for (let i = 0; i < newPosts.length; i++) {
            const post = newPosts[i];
            const clip = await page.evaluate(text => {
                const el = Array.from(document.querySelectorAll('[role="article"]'))
                    .find(e => (e as HTMLElement).innerText.includes(text));
                if (!el) return null;
                const rect = (el as HTMLElement).getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }, post.text);

            if (clip) {
                const folder = path.resolve(SCREENSHOTS_DIR, format(post.date, 'yyyy-MM-dd'));
                await ensureDirExists(folder);
                const file = `post_${Date.now()}_${i}.png`;
                const fullPath = path.resolve(folder, file);
                await page.screenshot({ path: fullPath, clip });
                post.screenshot = fullPath;
            } else {
                post.screenshot = '';
            }

            post.capturedDate = now.toISOString();
        }

        const writer = getCsvWriter();
        await writer.writeRecords(newPosts);
        log.info(`Saved ${newPosts.length} new posts to CSV.`);
    } catch (err) {
        log.error(`Scraping failed: ${err}`);
    } finally {
        if (browser) await browser.close();
    }
}
