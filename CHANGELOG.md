# Changelog

Product-impacting changes to admin-panel, public-site, and mobile. Newest first.

## 2026-08-03 (10) — Follow-up: white gap was back on every page, not just one field

- (9)'s keyboard-avoidance fallback padded `document.body`, but almost
  every screen in this app actually scrolls inside the tab shell's own
  `.tab-content` container (`overflow-y: auto`, fixed `100dvh` — see
  `tab-shell.scss`), not the document body. Padding body created a
  second, independent scroll layer on top of `.tab-content`'s real
  scroll, and `scrollIntoView()` dragged that outer body-scroll along
  too — visible as the padding itself, a blank white box above the
  keyboard, on every tab page (reported on the donation form's Phone
  number field, but not specific to it). Fixed by padding the focused
  field's actual nearest scrollable ancestor instead of hardcoding
  `body`. Confirmed clean on-device on both the donation form's Phone
  number field and the course rating's Optional note field, with the
  layout restoring correctly after the keyboard closes.

## 2026-08-03 (9) — Follow-up: adjustPan didn't pan for some fields either

- (8)'s `adjustPan` avoided the white-gap bug, but native panning turned
  out unreliable for WebView content too — fields near the end of a
  long page (e.g. the course rating note) never got panned into view
  at all. Switched back to `adjustResize` and added a JS-level
  "keyboard avoidance" fallback in `app.ts`: on `visualViewport`
  resize, reserve bottom padding equal to the keyboard height (so
  there's always room to scroll *to*, even for the last field on a
  page) and scroll the focused field into view once that layout
  change has committed. Confirmed on-device across login, a mid-page
  donate form, and the previously-broken end-of-page rating note.

## 2026-08-03 (8) — Follow-up: adjustResize left a white gap above the keyboard

- (7)'s `adjustResize` fix stopped the keyboard from covering fields,
  but introduced a different bug — a blank white gap between the
  focused input and the keyboard on some pages, from a known Android
  WebView resize-timing race. Switched to
  `android:windowSoftInputMode="adjustPan"` instead, which pans the
  window up to reveal the focused field without resizing/reflowing the
  page at all, avoiding the race entirely. Confirmed on-device.

## 2026-08-03 (7) — Fixed Android keyboard covering input fields

- `AndroidManifest.xml` had no `windowSoftInputMode`, so the WebView
  never resized when the soft keyboard opened — the keyboard just
  drew over whatever field you were typing into. Set
  `android:windowSoftInputMode="adjustResize"` so the page now shrinks
  to fit above the keyboard, matching normal Android app behavior.

## 2026-08-03 (6) — Mobile: added "Become a Student" application page

- Mirrors the public-site flow (built 2026-07-30): a `general` member
  can apply from Profile → Become a Student, submitting email/name/
  nickname (phone and LINE ID optional), reusing the existing
  `/me/student-application` endpoints. No backend changes needed.

## 2026-08-03 (5) — Mobile: added the Home banner carousel

- The Home page now shows the same rotating banner carousel as
  public-site's Home (`/public/home-banners`), so banners configured
  in admin's Home Banners page now actually appear on mobile too —
  previously mobile had no banner support at all.

## 2026-08-03 (4) — Splash: bigger seal, black background, Android now stretch-proof

- Reworked the Android splash as a layer-list (solid color + a 260dp
  icon centered via fixed dp box) instead of a set of pre-stretched
  per-density bitmaps — this makes it immune to the aspect-ratio
  stretching from (3) by construction, not just approximation, and
  lets the seal render noticeably larger.
- Switched the splash background to black on both platforms (was
  gold), per a quick side-by-side comparison on-device.

## 2026-08-03 (3) — Fixed Android splash circle looking stretched/oval

- Android renders the splash drawable as a raw window background, which
  stretches it to exactly fill the screen with no aspect-ratio
  preservation — the old splash images (~1.5-1.78 h/w, an older-phone
  preset) were stretched noticeably taller on modern ~2.05-2.2 h/w
  screens, making the round seal look egg-shaped. Rebuilt every splash
  density bucket at a ~2.16 h/w canvas so the stretch is minimal and the
  seal reads as a true circle again. Confirmed round on-device (Note9).
  iOS is unaffected (its launch image already uses aspect-fill scaling).

## 2026-08-03 (2) — Mobile app icon now has even padding on all sides

- Shrunk the seal artwork to ~72% of the icon canvas (was edge-to-edge)
  so every launcher icon variant shows even breathing room around the
  circle instead of being cropped flush to the edge. Splash screen
  unchanged.

## 2026-08-03 (1) — Mobile app icon/splash updated to the revised seal artwork

- Regenerated the Android/iOS launcher icon and splash screen from a
  revised `android/icon/willpowericon.png` (cleaner circular crop,
  transparent background) — same gold splash background as before.

## 2026-07-31 (2) — Mobile app icon updated to the official Willpower Institute seal

- Replaced the app icon and splash screen (Android + iOS) with the
  official round seal (`android/icon/willpowericon.png`), regenerated
  at every density, same gold splash background as before.

## 2026-07-31 (1) — iOS platform scaffolding + TestFlight CI pipeline

- Added the `ios/` Capacitor platform and a GitHub Actions workflow
  (`.github/workflows/ios-build.yml`) that builds and uploads to
  TestFlight on a free macOS runner — see `ios/SETUP.md` for the
  one-time secrets/Apple Developer Portal setup still needed before
  the first real run.
- Swapped the push notification plugin from `@capacitor/push-notifications`
  to `@capacitor-firebase/messaging` so iOS yields an FCM token like
  Android does — the backend's Firebase Admin SDK can only target FCM
  tokens, and the old plugin gave iOS a raw APNs token it couldn't use.
- Added **Sign in with Apple** to the mobile app (iOS only) — App Store
  guideline 4.8 requires it whenever Google/Facebook sign-in is offered.
- Generated iOS app icon + splash screen from the same artwork used for
  Android, and added the Info.plist permission strings / Facebook and
  Google native config needed for social login and the QR/biometric
  features to work on iOS.

## 2026-07-30 (6) — Home page hero text is now editable via admin

- New admin page **Site Content → Home Hero** to edit the Home page's
  eyebrow tagline, two-line heading, description, and the 3-stat row
  (value + label for each) — previously hardcoded in the template.
  Public-site Home falls back to the original copy if nothing has been
  saved yet, so the page never looks broken pre-edit.

## 2026-07-30 (5) — Fixed Home page course cards not being clickable

- The "Courses & programs" cards on the public-site Home page only had
  a small "Enroll →" link clickable; the rest of the card (image, title)
  did nothing. The whole card is now a link to the course detail page,
  matching how the Events cards already behaved.

## 2026-07-30 (4) — Updated mobile app icon and splash screen

- Replaced the Android app icon/adaptive-icon and the splash screen with
  a new source image (`android/icon/wpusaiconv2.png`), regenerated at
  every density — same gold background and centered-icon layout as
  before, new artwork.

## 2026-07-30 (3) — Course prerequisites

- Courses can now require completion of other courses first (e.g. Course B
  requires Course A) — set in Manage Course as a "Requires" multi-select of
  other course titles. Courses with nothing selected enroll exactly as
  before, no approval step added.
- Course cards on Home and the Courses list (public-site + mobile) now
  show a gold "🔒 Requires ..." pill when a course has a prerequisite, so
  it's visible before tapping in — not just buried on the detail page.
- The Course detail page's prerequisite note is now a bolder callout
  (gold background, left accent bar, lock icon) instead of a plain line
  of text. Self-enrollment is blocked with a clear message until the
  member has completed each required course; admins enrolling a member
  manually from the admin panel can still bypass the requirement.

## 2026-07-30 (2) — Certificate Templates layout designer: edit-mode gating, Save/Cancel, font size

- The Layout designer on Certificate Templates now opens in a read-only
  preview — you must click "✎ Edit Layout" to drag fields, add/remove them,
  or edit the header text. Changes are staged locally; **Save** commits
  them, **Cancel** discards and reverts to the last saved layout (previously
  every drag/edit auto-saved immediately).
- Each placed field now has a **−/+ font-size stepper** (6-72pt), which
  also controls the actual size used when generating the certificate PDF.
- Removed the redundant "View layout" (▦) row-action button — clicking a
  template row already selects it; the designer card now also
  auto-scrolls into view when you do.
- "Upload new template" moved onto the same row as the Branch filter.

## 2026-07-30 (1) — Apply to become a student (general → student)

- New self-service flow: a `general` member can apply to become a student
  from **My Account → Become a Student** (public-site), submitting
  email/full name/last name/nickname (phone and LINE ID optional).
- New admin page **People → Student Applications** to review pending
  requests and Approve (flips the member's role to `student`) or Reject —
  a searchable, paginated data table (matching every other list page in
  admin-panel) with filter tabs for Pending/Approved/Rejected/All.

## 2026-07-29 (9) — Module Usage report redefined around public-site activity

- The "Module Usage" report tab now measures what public-site/mobile
  **users** actually do (RSVPs, enrollments, donations, ratings submitted)
  instead of mixing in admin-only actions (broadcasts sent, certificates
  issued) — so "most/least used module" reflects real end-user engagement.

## 2026-07-29 (8) — Star ratings now shown on Event/Course list cards

- The Events list page and Courses list page (public-site + mobile) now show
  the aggregate star rating on every card, same as Home and the detail
  pages — average + count only, no notes.

## 2026-07-29 (7) — Star ratings now shown on the Home page

- Upcoming event cards and course offering cards on the Home page
  (public-site + mobile) now show the aggregate star rating (average +
  count) when at least one rating exists, matching the event/course detail
  pages — read-only, no notes shown, same as everywhere else public.

## 2026-07-29 (6) — 5-star feedback on Events and Course Offerings

- **Members (public-site + mobile)** can now rate an event or a class
  offering 1-5 stars, with an optional private note, from the event/course
  detail page. Submitting again updates their existing rating instead of
  creating a duplicate. The aggregate average + rating count is shown
  publicly next to the event/offering — **notes are never shown publicly.**
- **Admins** get a new "Feedback" action (★ icon) on each event/course row,
  showing every rating with who gave it, their note, and when — so
  admin/superadmin can see *why* something was rated the way it was and use
  it to improve future events/courses. Course feedback groups by which
  offering the rating belongs to.

## 2026-07-29 (5) — Reports: Module Usage tab

- Added a "Module Usage" tab to Reports, ranking Events/Courses/Giving/
  Certificates/Broadcast by total activity (RSVPs, enrollments, donations,
  certificates issued, broadcasts sent) so admins can see which modules are
  used most vs. least.

## 2026-07-29 (4) — Home page banner carousel (admin-managed)

- **New "Home Banners" page under Site in the admin sidebar.** Admins can
  add banner images with an optional scheduling window (start date, end
  date or no end date) and an on/off toggle, and reorder them.
- Public-site's Home page now shows an auto-advancing carousel (with
  prev/next buttons and dots) of every banner that is currently on and
  within its date window, above the hero section. Each banner can
  optionally link to a page (e.g. `/events`) or an external URL.
- Seeded with 3 sample banners so the carousel isn't empty by default —
  replace them from the admin panel.

## 2026-07-29 (3) — Privacy Policy restored to sectioned layout

- Reworked the Privacy Policy content model from one big HTML blob back
  into a list of numbered sections with a sticky table-of-contents, matching
  the site's original look — now admin-editable (add/edit/delete/reorder
  sections) instead of hardcoded.

## 2026-07-29 (2) — Admin-editable About page + Privacy Policy

- **New "About Page" and "Privacy Policy" pages under Site in the admin
  sidebar.** Admins can now edit the About page's eyebrow/title/lead text, add
  or remove images in a banner carousel (previously a single hardcoded image),
  and add/edit/delete "Our journey" timeline entries (year + title +
  description) — all without a code deploy.
- The Privacy Policy is now a single admin-editable HTML field (with a "last
  updated" label) instead of hardcoded markup, edited from its own admin page
  with a live preview.
- Public-site's About page now renders the banner as an auto-advancing,
  swipeable-by-dots carousel when more than one image is configured.
- Backed by a new generic `site_content` table/API (see api CHANGELOG) —
  public pages fall back to the original hardcoded content if nothing has
  been edited yet.

## 2026-07-29 (1) — Donations close on past events and ended course offerings

- **Past events**: the donate tab on an event's detail page (mobile +
  public-site) now shows "This event has already ended — donations are
  closed" instead of the donation form, once the event's date has passed.
- **Ended course offerings**: the donate tab on a course's detail page
  (mobile + public-site) now closes per-offering once that offering's end
  date has passed, showing "This class has already ended — donations are
  closed."
- **Admin Course donation needs**: removed the "whole course" donation-target
  option — every new donation need must now target a specific class offering.

## 2026-07-28 (6) — Mobile: Home never pops into leftover navigation history

- **Pressing back while on Home now always shows the double-back-to-exit
  prompt**, regardless of how much navigation history piled up getting
  there (e.g. several drill-downs deep, then tapping the Home tab). Home
  previously still had Capacitor's native `canGoBack` respected, so back
  could pop into a stale previous page instead of behaving like the app's
  true root.
  - Verified on-device: Home → Events → Courses → Profile → My Courses →
    tap Home tab → back → shows "Press back again to exit" instead of
    landing on My Courses/Profile.

## 2026-07-28 (5) — Mobile: fixed back button jumping between tabs instead of going Home

- **Pressing back while on a bottom-tab screen (Events, Courses, Profile) now
  always goes to Home**, instead of landing on whichever tab was visited
  previously. Tapping between tabs pushes a plain history entry each time,
  so the back stack reflected tap order (e.g. Home → Events → Courses meant
  back from Courses landed on Events) rather than a sensible "go home"
  default.
  - Drilling into a detail page from a tab (e.g. Events → an event's detail
    page) is unaffected — back from a detail page still returns to that
    tab's list, since that navigation still pushes normally.
  - Verified on-device: Home → Events → Courses → back → Home; and
    Events → event detail → back → Events.

## 2026-07-28 (4) — Mobile: removed square tap-flash app-wide

- **Tapping any button/link no longer flashes a gray square** — Chrome
  WebView's default tap-highlight draws as a plain rectangular bounding box
  regardless of the element's own border-radius, so it showed as a square
  behind the round PIN-pad keys and bottom tab bar items. Disabled
  `-webkit-tap-highlight-color` globally (every interactive element already
  has its own `:active` state — the bottom tab bar scales down slightly,
  the PIN pad shows a circular tint contained within its own border) rather
  than patching each component individually.

## 2026-07-28 (3) — Mobile: widened the passcode/PIN pad

- **The number pad on the "Confirm it's you" unlock screen and the "Set a
  PIN" screen is noticeably wider and less cramped** — the shared PIN-pad
  component was capped at 260px wide regardless of screen size, leaving
  large empty margins on a normal phone width. Widened to 340px, and each
  key is now a visible circle sized to fit snugly around its digit
  (previously plain text glyphs floating in empty space with no visible tap
  boundary), with a subtle press state.

## 2026-07-28 (2) — Mobile: back button now requires a second press to exit

- **Pressing back from the app's root screen (Home, or any tab with no
  further history) no longer exits immediately.** First press shows a
  "Press back again to exit" toast at the bottom of the screen; a second
  press within 2 seconds actually exits, matching the standard Android
  double-back-to-exit pattern. A press that comes later than 2 seconds after
  the first is treated as a fresh first press (shows the toast again) rather
  than exiting.
  - Verified on-device: two back presses ~0.8s apart correctly exits to the
    launcher; a single press leaves the app in the foreground with the
    toast showing.

## 2026-07-28 (1) — Mobile: fixed hardware/gesture back button not navigating correctly

- **Android's back button (hardware key or gesture) now properly steps back
  through the app's screens.** The app never had a
  `@capacitor/app` `backButton` listener registered, so Capacitor's default
  behavior applied — undefined/inconsistent, and in practice often skipped
  screens or exited the app entirely instead of popping one level of the
  router history, matching the reported "some menus don't pop back
  correctly."
  - Added a listener in the root component that calls `window.history.back()`
    when `canGoBack` is true, or exits the app when at the root.
  - Also debounced it (400ms) after discovering a single physical back press
    triggers the native `backButton` event multiple times in rapid
    succession on this Samsung device — without the guard, one press could
    cascade through several screens at once. Verified on-device via logcat:
    before the fix, one back press logged 5 separate `backButton` events and
    exited the app from a one-level-deep screen; after, exactly 1 event and
    a correct single-level pop.

## 2026-07-27 (5) — Mobile: delete notifications, modernized notification cards, scan button moved to tab bar

- **Users can now delete their own notifications** (in-app bell/list, all
  platforms). New `DELETE /me/notifications/:id` endpoint, scoped to the
  owning user. A "×" button on each notification row/card removes it
  immediately without marking it read first.
- **Mobile's Notifications page redesigned**: each row now shows a rounded
  icon avatar (varies by notification type — event, reminder, certificate,
  donation, etc.), an unread dot next to the title instead of a full
  background tint, relative "Today · 3:28 PM" timestamps, and a friendlier
  empty state. Public-site's header notification dropdown also gained the
  delete button.
- **Mobile's QR scan button moved from the Home header into the bottom tab
  bar** as a normal tab item between Events and Courses (Home / Events /
  Scan / Courses / Profile), styled identically to the other tabs (same
  icon size, label, active-state color) with a QR-code glyph instead of a
  generic icon. (Tried a raised floating/notch style first per an early
  request — reverted to a plain uniform tab item after visual feedback.)
  Tab bar taps now have a subtle press/scale animation for better feedback.

## 2026-07-27 (4) — Native push notifications (Phase 3)

- **Broadcasts now also arrive as real OS push notifications on the mobile
  app**, not just the in-app bell from Phase 1. Backend sends via Firebase
  Cloud Messaging (FCM) when a broadcast is created; the mobile app registers
  for push on login (Capacitor `@capacitor/push-notifications`) and posts its
  device token to a new `POST /me/devices` endpoint (`user_devices` table,
  previously unused). Tapping a push opens the Notifications page; logging
  out unregisters the device.
  - Push sending is a graceful no-op if Firebase credentials aren't configured
    (same pattern as `TURNSTILE_SECRET_KEY`) — set
    `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH`, plus
    `android/app/google-services.json`, to enable it. Verified end-to-end on
    a physical Android device: token registers on login, a broadcast triggers
    a real notification in the system shade.
  - Android's manifest now references a `network_security_config.xml` that
    permits cleartext HTTP only to `localhost`/`10.0.2.2` — needed so a debug
    build can reach a local dev API via `adb reverse` during testing;
    production traffic (HTTPS to `api.wpusa.online`) is unaffected.

## 2026-07-27 (3) — Broadcast announcements (Phase 1: in-app, no native push yet)

- **Superadmin and admin can now send announcements as in-app notifications**,
  viewable via a new bell icon on the public-site header and a new
  Notifications page on mobile (added to Home's header). New "Broadcast" page
  in admin-panel (Site section) with a compose form (title, message, audience,
  optional students-only filter) and a send history below. Admin's audience is
  restricted to their own branch (reuses the branch-scoping work from earlier
  today); superadmin can target a specific branch or everyone.
  - This is **Phase 1 only** — notifications appear in-app (bell icon, polled
    every 60s), not as native OS push notifications. That requires a Firebase
    project + `@capacitor/push-notifications` and is a separate follow-up.
  - Also **Phase 1 only** covers manual admin broadcasts — automatic system
    notifications (new event published, new course, RSVP/class reminders,
    certificate issued) are not wired up yet, though the underlying
    `notifications` table and `notification_type` enum already support them
    (they existed unused in the schema before this change).
  - Backend: new `notifications` module (`POST /notifications/broadcast`,
    `GET /notifications/broadcasts` for history, `GET/PATCH /me/notifications*`
    for self-service). `notifications` table gained `broadcast_id` (groups the
    per-recipient rows from one send), `target_branch_id`, and `created_by`.

## 2026-07-27 (2)

- **Admin and instructor roles are now scoped to their assigned branch(es)
  across the whole admin panel — superadmin still sees/edits everything.**
  Previously only Donations, Users, Team Members, and Course Offerings/Class
  Schedule enforced this; Events (+ needs/photos/attendance), Enrollment,
  Certificates (issuance + registry), Manage Branch, and Reports did not —
  an admin or instructor could see and modify every branch's data through
  those pages. Fixed by adding a shared `BranchAccessService` and applying
  it consistently: list endpoints filter to the actor's branches, single-item
  endpoints 404 (not 403, so a locked-out actor can't tell the row exists)
  when the target is outside the actor's branches, and create/update reject
  attempts to target a branch the actor isn't assigned to.
  - Instructors were previously scoped by "offerings you personally teach"
    (an `instructorId` match) rather than by branch — changed to match
    admin's branch-based scoping instead, per this request. **Every
    instructor account now needs at least one `user_branches` row** for
    this to work; one seed instructor account was missing this and has
    been fixed locally — check production for the same gap before deploying.
  - Manage Branch (`/branches` in admin-panel) is no longer superadmin-only:
    admin can now view and edit their own branch's info (name, address,
    description, photo, etc.), but changing a branch's active/inactive
    status, and creating or deleting branches, still require superadmin.

## 2026-07-27

- The public branch detail page now lists every field an admin can set on
  a branch — Country, City, Timezone, Address, Zip/Postal code, Phone
  Number, Branch email — not just address/phone/email, grouped into
  "Location" and "Contact" sections with a cleaner two-column layout
  matching the rest of the site's editorial style (gold section labels,
  italic "Not provided" for empty fields) instead of a plain bordered
  list. (Branches with no description still show a generic placeholder
  line until an admin sets one via Manage Branch — that text isn't real
  data.)
- **Admin can now set a branch's Description**, shown on the public branch
  detail page added below. This field existed in the database already but
  was never exposed in the create/edit branch form (superadmin → Manage
  Branch) or the API's create/update DTOs — admins had no way to set it.
  Added a "Description" textarea to the branch form and wired it through
  to the API and public website.
- **Branches are now clickable through to a real detail page.** The Home
  page's "Branches" stat, the "Our branches" cards on the About page, and
  the footer's branch names all previously did nothing (or were plain
  text). They now link to a new branch detail page (`/branches/:id`)
  showing the branch's city/country, description, and contact info, backed
  by a new `GET /public/branches` and `GET /public/branches/:id` (the
  existing `branches` endpoints were admin-only). Mobile's Profile →
  About Willpower Institute → Branches row was static text; it now opens
  the same About-page branches section like the About/Team rows already
  did.
- Fixed public-site's Home "Courses & programs" cards showing no image at
  all — the card template never had an `<img>` element (unlike the Events
  cards next to it, or the standalone Courses list page). Added the same
  image + corner-ribbon treatment used on the Courses list page.

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
