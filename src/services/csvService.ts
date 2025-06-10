import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import { CSV_FILE_PATH } from '../constants';

export const loadExistingData = async (): Promise<Set<string>> => {
  if (!fs.existsSync(CSV_FILE_PATH)) return new Set();
  const content = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
  return new Set(
    content
      .split('\n')
      .slice(1)
      .map(line => line.split(',')[0].trim())
      .filter(Boolean)
  );
};

export const getCsvWriter = () => {
  return createObjectCsvWriter({
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
};