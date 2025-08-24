/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    const isProduction = process.env.NODE_ENV === 'production'

    const rewrites = []

    // API rewrites
    if (apiUrl) {
      rewrites.push({
        source: '/api/altitrace/:path*',
        destination: `${apiUrl}/v1/:path*`,
      })
    } else if (isProduction) {
      const internalApiUrl =
        process.env.INTERNAL_API_URL || 'http://127.0.0.1:8080'
      rewrites.push({
        source: '/api/altitrace/:path*',
        destination: `${internalApiUrl}/v1/:path*`,
      })
    } else {
      rewrites.push({
        source: '/api/altitrace/:path*',
        destination: 'https://api.altitrace.reachaltitude.xyz/v1/:path*',
      })
    }

    return rewrites
  },
  async headers() {
    return [
      {
        source: '/api/altitrace/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ]
  },
  assetPrefix:
    process.env.NODE_ENV === 'production'
      ? 'https://altitrace.reachaltitude.xyz'
      : '',
  async redirects() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/:path*',
          has: [
            {
              type: 'header',
              key: 'x-forwarded-proto',
              value: 'http',
            },
          ],
          destination: 'https://altitrace.reachaltitude.xyz/:path*',
          permanent: true,
        },
      ]
    }
    return []
  },
}

module.exports = nextConfig
