# Changelog

Product-impacting changes to admin-panel, public-site, and mobile. Newest first.

## 2026-07-24

- **Removed the "Whole course" needs/donations section from Course detail, and
  moved Donors inside each offering's own card.** The "Whole course" bucket
  (a separate needs list + "General donation" not tied to any offering) looked
  redundant once offerings became the primary unit — it duplicated the same
  give/donate UI as each offering card. It's gone; every need and donation is
  now scoped to a specific offering. The Donors list moved from one shared
  section at the bottom of the page into each offering's own expandable card,
  right below its "General donation to this offering" option, so donors are
  visibly separated per offering rather than pooled together.
- **Course detail now shows only the offering you came from, and its Donors list
  is scoped to it.** Arriving at a course via a specific offering card (from Home
  or Courses) previously still listed every offering of that course together, and
  the Donors list mixed donations from all of them — donating $X to the Canada run
  looked identical to a $X donation for the Australia run. `donations` gained an
  `offering_id` column (mirrors `course_needs.offering_id`) so a "General donation
  to this offering" is now recorded against that exact offering, not just its
  branch. Each offering's Donors list only shows donations made to that exact
  offering. Visiting `/courses/:id` directly (no offering selected) still shows
  every offering, each with its own scoped Donors list, as before.
- **Offerings are now listed as fully separate cards, not grouped under one course
  card.** On the Home page's "Courses & programs" section and the standalone
  Courses list page (public-site + mobile), a course with multiple open offerings
  (e.g. "The Path of Willpower" running in both the United States and Australia)
  now shows as two independent listings sharing only the title — previously it
  showed as a single course card and offerings were hidden until you dug in.
  Each card shows its own branch, mode, start date, and enrollment status.
  Tapping a card goes straight to that course's detail page with the matching
  offering card already expanded and scrolled into view. Backed by a new
  `GET /public/courses/offerings` endpoint that returns one row per open
  offering (joined with its parent course's title/image/category) instead of
  one row per course.
- **Each Offering on the Course detail page (public-site + mobile) is now its own
  visually distinct card**, with a diagonal corner ribbon showing the branch and
  start date, instead of being nested rows inside one shared course-level box —
  makes it much easier to tell offerings apart at a glance, especially once
  there are 2-3 running concurrently.
- The same diagonal branch/date ribbon was also added to the new offering cards
  on Home and the Courses list (both projects), so the branch and start date are
  visible at a glance without opening the card.
- Removed the "Offerings" count stat from the Course detail page's facts row
  (public-site + mobile) — now redundant since each offering already appears as
  its own separate listing on Home/Courses.

## 2026-07-23

- **Course donations and needs can now be scoped to a specific offering**, not just
  the whole course. `course_needs` gained an optional `offering_id` (kept alongside
  the existing `session_number` — a need can target the whole course, a specific
  offering, or both). This fixes two real problems: (1) a general/untargeted course
  donation used to silently credit the branch of the course's *first* offering even
  when the student picked a donation while a different offering; (2) there was no
  way to say "these 15 prayer mats are needed at the Toronto onsite run" specifically.
  Admin's Course Needs page gained an "Offering" selector alongside "Session";
  Manage Donations' Target column now shows which offering a course donation
  targeted.
- **Course detail pages (public-site + mobile) redesigned around Offerings.** Each
  offering is now an expandable card (branch/mode/dates/seats — plus a real weekly
  schedule like "Mon, 6:00–8:00 PM" once the schedule fix below is deployed) that
  reveals its own donation needs and a "General donation to this offering" option
  when expanded — previously offerings were just a flat enroll-only list with no
  way to donate toward a specific one, and every course donation looked identical
  regardless of which run it supported. A "Whole course" section still covers
  needs/donations not tied to any specific offering. Donor list rows now show which
  offering a donation targeted, when applicable.
  - **Note:** the "real weekly schedule" line requires the backend change above to
    be deployed to production (`api.wpusa.online`) — it was only tested against a
    local dev API so far. Until deployed, offering cards correctly fall back to
    just showing branch/dates/seats (verified this fallback doesn't break anything).

## 2026-07-22

- Added the Donors/Give/donate-widget and Atmosphere photo gallery to the mobile
  app's Event detail and Course detail pages (previously public-site only): a
  Give/Donors tab pair, per-need donation cards with progress bars (grouped by
  session on courses), a General donation card, a donation form (amount/quantity,
  phone, optional payment-slip upload), the approved donor list, and a horizontal-
  scroll Atmosphere photo gallery (tap to view full-screen). Reuses the existing
  `/public/events(or courses)/:id/{needs,donations,photos}` endpoints — no backend
  changes needed. Added `UploadApiService`, `ImageViewerService`, and a shared
  `<app-photo-viewer>` overlay to mobile to support this.
- Added an "About Willpower Institute" section to the mobile app's Profile page
  (About / Team / Branches / Privacy Policy), opening the corresponding
  public-site pages in an in-app browser. Branches is a static United
  States/Canada/Australia line (no dedicated page exists for it).
- Rebuilt the mobile Event detail page's RSVP UI to match public-site: a
  "Seats reserved" progress bar, three-way RSVP (Yes/Maybe/Can't make it,
  previously just a single "RSVP now" button), an RSVP confirmation message,
  RSVP-closed handling, and a "Scan to check in" link once confirmed. Also
  swapped the Date/Time/Going stats row for Date/Time/Location (Going is now
  covered by the new seats-reserved bar).
- Added Upcoming/Live/Past/All-events filter tabs to the mobile app's Events
  list (previously showed every event with no filtering), matching public-site.
- Added a "Courses & programs" section to the mobile app's Home page (mirrors the
  public-site homepage layout), alongside the existing "Upcoming events" section.
  Pulls from the same public `/public/courses` catalog used by the Courses tab.
  The list/card view toggle now switches both sections together (was Events-only),
  defaults to card view, and there's proper spacing between the two sections.
- Fixed the mobile app's QR check-in camera failing to start on Android
  (`Could not start the camera.`): `AndroidManifest.xml` never declared
  `android.permission.CAMERA`, so the barcode-scanner plugin's runtime
  permission request silently failed. Added the permission declaration.
  Devices that already tried the camera under the broken build may have the
  permission stuck in a denied state (Android auto-denies undeclared
  permissions without showing a dialog) — if the camera still fails after
  updating, clear it via Settings → Apps → Willpower Institute → Permissions,
  or reinstalling fresh.
- Fixed the QR scan page showing solid black instead of the live camera feed
  even after the permission fix above: the page's own opaque background color
  was painting over the transparent WebView area that the native camera
  preview renders behind. Now transparent only in native (on-device) mode.
- Fixed the mobile app's bottom tab bar scrolling out of view on long pages;
  it now stays pinned while page content scrolls independently.
- Added a back button to every detail/sub-page that was missing one (event
  detail, course detail, attendance stats, certificate received, and the
  My Courses/Certificates/RSVPs/Donations profile pages).
- Fixed Cloudflare Turnstile failing on-device (WebView origin
  `https://localhost` wasn't on Turnstile's allowed-domains list). The app's
  WebView now runs under `https://app.wpusa.online` (via Capacitor's
  `server.hostname` config, no real DNS needed) so Turnstile validates
  correctly both in the emulator and on real hardware.

## 2026-07-20

- Added the `mobile` Angular + Capacitor app (Android; iOS scaffold-only until a
  Mac/cloud-Mac CI is available): Splash, onboarding, Login/Register (Turnstile
  + Google/Facebook SSO), Home dashboard, Event/Course browse with real-time
  RSVP/enroll, QR check-in (camera scan, falls back from event to course-session
  check-in since the QR only encodes a bare UUID), Attendance Stats, Certificate
  view/download/share, Profile with My Courses/Certificates/RSVPs/Donations, and
  a PIN + biometric unlock gate (skippable, forces full re-login on cold start if
  skipped). No backend changes were needed — reuses the existing `/me/*` and
  `/public/*` endpoints.

- Auto-logout on expired/invalid session: previously, once a token expired,
  authenticated requests just failed silently while the app still looked
  logged in. Now a 401 clears the session and redirects to login (both apps).
- Added a "Keep me signed in" option and a Cloudflare Turnstile widget to
  admin-panel and public-site login.
- Brought admin-panel's login page to visual parity with public-site's (card
  styling, spacing, show/hide password toggle, Forgot-password row).
