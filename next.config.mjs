/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // Proxy para GraphQL
        source: '/api-proxy/graphql',
        destination: 'http://cronosprintedapi.glr.test/graphql',
      },
      {
        // Proxy para la API REST
        source: '/api-proxy/rest/:path*',
        destination: 'http://cronosprinted.glr.test/api/:path*',
      },
    ];
  },
};

export default nextConfig;