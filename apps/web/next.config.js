module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/baselines/:path*',
        destination: '/baselines/:path*',
      },
    ];
  },
}
