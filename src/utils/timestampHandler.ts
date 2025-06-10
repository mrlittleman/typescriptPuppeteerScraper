import fs from 'fs';
import path from 'path';

interface TimestampData {
  lastScrapeTimestamp: string;
}

const TIMESTAMP_FILE_PATH = path.resolve(__dirname, '../../lastScrapeTimestamp.json');
export async function saveLastScrapeTimestamp(timestamp: string): Promise<void> {
  const data: TimestampData = { lastScrapeTimestamp: timestamp };
  fs.writeFileSync(TIMESTAMP_FILE_PATH, JSON.stringify(data));
}

export async function loadLastScrapeTimestamp(): Promise<Date | null> {
  if (fs.existsSync(TIMESTAMP_FILE_PATH)) {
    const content = fs.readFileSync(TIMESTAMP_FILE_PATH, 'utf-8');
    const data: TimestampData = JSON.parse(content);
    return new Date(data.lastScrapeTimestamp);
  }
  return null;
}
