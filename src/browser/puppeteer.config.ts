import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdBlockerPlugin from 'puppeteer-extra-plugin-adblocker';

puppeteer.use(StealthPlugin());
puppeteer.use(AdBlockerPlugin());

export async function loginFacebook(email: string, password: string) {
  const browser = await puppeteer.launch({ headless: false, executablePath: '/google-chrome'});
  const page = await browser.newPage();
  await page.goto('https://www.facebook.com/login');

  await page.type('#email', email, { delay: 500 });
  await page.type('#pass', password, { delay: 500 });
  await page.click('[name="login"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  return browser;
}
