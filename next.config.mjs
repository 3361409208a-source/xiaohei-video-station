/** @type {import('next').NextConfig} */
const nextConfig = {
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
