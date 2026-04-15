import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline scripts + Turnstile
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      // Styles (Next.js + Turnstile widget)
      "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      // Images: self + Google profile pics + data URIs
      "img-src 'self' data: https://lh3.googleusercontent.com",
      // Fonts
      "font-src 'self'",
      // API calls: self + Cloudflare Turnstile verify endpoint
      "connect-src 'self' https://challenges.cloudflare.com",
      // Frames: Cloudflare Turnstile widget renders in iframe
      "frame-src https://challenges.cloudflare.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google profile pictures
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
