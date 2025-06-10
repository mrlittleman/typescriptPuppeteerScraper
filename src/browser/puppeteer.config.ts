import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdBlockerPlugin from 'puppeteer-extra-plugin-adblocker';
import type { Browser } from 'puppeteer';
import { getRandomUserAgent } from '../config/userAgents.ts';

puppeteer.use(StealthPlugin());
puppeteer.use(AdBlockerPlugin());

export async function launchConfiguredBrowser(): Promise<Browser> {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--disable-infobars',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  return browser;
}

export async function loginFacebook(email: string, password: string): Promise<Browser> {
  const browser = await launchConfiguredBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(getRandomUserAgent());
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email', { visible: true });
  await page.type('#email', email, { delay: 100 });
  await page.waitForSelector('#pass', { visible: true });
  await page.type('#pass', password, { delay: 100 });
  await page.click('button[name="login"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
  console.log('Login successful');

  return browser;
}
