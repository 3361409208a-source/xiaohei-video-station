import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readInviteGateEnabled() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    const config = JSON.parse(raw);
    return config.invite?.enabled === true;
  } catch {
    return false;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    SITE_INVITE_GATE_ENABLED: readInviteGateEnabled() ? 'true' : 'false',
  },
  async rewrites() {
    return [
      {
        source: '/sitemap-:id.xml',
        destination: '/sitemap/:id.xml',
      },
    ];
  },
};

export default nextConfig;
