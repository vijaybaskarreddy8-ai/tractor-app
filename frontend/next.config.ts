import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin();

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  register: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development', // disable in dev to prevent caching issues
});

const nextConfig: NextConfig = {
  // We can add other NextConfig options here
};

export default withSerwist(withNextIntl(nextConfig));
