# Changelog

Product-impacting changes to admin-panel and public-site. Newest first.

## 2026-07-20

- Auto-logout on expired/invalid session: previously, once a token expired,
  authenticated requests just failed silently while the app still looked
  logged in. Now a 401 clears the session and redirects to login (both apps).
- Added a "Keep me signed in" option and a Cloudflare Turnstile widget to
  admin-panel and public-site login.
- Brought admin-panel's login page to visual parity with public-site's (card
  styling, spacing, show/hide password toggle, Forgot-password row).
