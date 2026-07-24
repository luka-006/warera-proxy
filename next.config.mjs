/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.warera.io" },
      { protocol: "https", hostname: "media.warera.io" },
      { protocol: "https", hostname: "flagcdn.com" }
    ]
  }
};

export default nextConfig;
