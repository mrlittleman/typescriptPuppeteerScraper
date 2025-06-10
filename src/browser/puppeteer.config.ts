import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdBlockerPlugin from 'puppeteer-extra-plugin-adblocker';
import { executablePath } from 'puppeteer';

puppeteer.use(StealthPlugin());
puppeteer.use(AdBlockerPlugin());

export async function loginFacebook(email: string, password: string) {
  const launchOptions: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  };

  if (process.env.CI) {
    launchOptions.executablePath = executablePath();
  } else {
    launchOptions.executablePath = '/usr/bin/google-chrome';
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.facebook.com/login', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('#email', { timeout: 15000 });
    await page.type('#email', email, { delay: 100 });
    await page.waitForSelector('#pass', { timeout: 15000 });
    await page.type('#pass', password, { delay: 100 });
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      page.click('[name="login"]')
    ]);

    const loginError = await page.$('#error_box');
    if (loginError) {
      throw new Error('Facebook login failed');
    }

    return browser;
  } catch (error) {
    if (process.env.CI) {
      await page.screenshot({ path: '/tmp/login-error.png' });
    }
    await browser.close();
    throw error;
  }
}