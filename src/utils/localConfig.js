import fs from 'fs';
import path from 'path';

export function readLocalSiteConfig() {
  try {
    const filePath = path.join(process.cwd(), 'config.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
