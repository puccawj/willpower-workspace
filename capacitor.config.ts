import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.willpowerinstitute.app',
  appName: 'Willpower Institute',
  webDir: 'dist/mobile/browser',
  // Capacitor's default WebView origin is "https://localhost", which Cloudflare
  // Turnstile's domain allowlist rejects (it requires a dotted domain format). This
  // hostname doesn't need real DNS — Capacitor intercepts and serves local assets
  // under it directly — but gives the app a real-looking origin to allowlist.
  server: {
    hostname: 'app.wpusa.online',
    androidScheme: 'https',
    iosScheme: 'https',
  },
  // Only bundle the providers sso-buttons.ts actually uses — Twitter is enabled by
  // default by the plugin otherwise, which bloats both platform builds for nothing.
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: true,
        twitter: false,
      },
    },
  },
};

export default config;
