import fs from 'fs';
import fsExtra from 'fs-extra';

export const ensureDirExists = async (dir: string) => {
  await fsExtra.ensureDir(dir);
};

export const fileExists = (path: string) => fs.existsSync(path);