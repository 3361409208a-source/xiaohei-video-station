/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
