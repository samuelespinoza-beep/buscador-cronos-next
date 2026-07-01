// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   async rewrites() {
//     return [
//       {
//         // Proxy para GraphQL
//         source: '/api-proxy/graphql',
//         destination: 'http://cronosprintedapi.glr.test/graphql',
//       },
//       {
//         // Proxy para la API REST
//         source: '/api-proxy/rest/:path*',
//         destination: 'http://cronosprinted.glr.test/api/:path*',
//       },
//     ];
//   },
// };

// export default nextConfig;

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  async rewrites() {
    return [
      {
        // Proxy para GraphQL
        source: '/api-proxy/graphql',
        destination: isProd
          ? (process.env.NEXT_PUBLIC_GRAPHQL_URL || 'https://ciao-approx-provinces-nickel.trycloudflare.com/graphql')
          : 'http://cronosprintedapi.glr.test/graphql',
      },
      {
        // Proxy para la API REST
        source: '/api-proxy/rest/:path*',
        destination: isProd
          ? 'https://ciao-approx-provinces-nickel.trycloudflare.com/api/:path*'
          : 'http://cronosprinted.glr.test/api/:path*',
      },
    ];
  },
};

export default nextConfig;