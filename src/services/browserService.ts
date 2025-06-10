import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdBlockerPlugin from 'puppeteer-extra-plugin-adblocker';
import { loginFacebook } from '../browser/puppeteer.config';

puppeteer.use(StealthPlugin());
puppeteer.use(AdBlockerPlugin());

export async function getBrowser(email: string, password: string) {
  return await loginFacebook(email, password);
}
