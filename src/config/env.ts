import dotenv from 'dotenv';
dotenv.config();

export const FB_EMAIL = process.env.FB_EMAIL!;
export const FB_PASSWORD = process.env.FB_PASSWORD!;

if (!FB_EMAIL || !FB_PASSWORD) {
  throw new Error("Missing FB_EMAIL or FB_PASSWORD in environment.");
}
