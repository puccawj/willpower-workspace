# Changelog

Product-impacting changes to admin-panel, public-site, and mobile. Newest first.

## 2026-08-12 (1) — LINE ID and photo stay editable in Edit Profile after approval

- LINE ID and photo previously lived only on the student application record, editable
  while status was `pending` — once an admin approved the application, the edit form
  disappeared and both became permanently locked with no way to update them again.
- Promoted both to the account profile itself (new `line_id`/`photo_url` columns on
  `users`, migration `2026-08-12-add-user-lineid-photo.sql`), alongside nickname/phone
  which were already there. Now always editable in **Edit Profile → Your details**,
  regardless of application status, on both mobile and the website
  (https://wpusa.online).
- **Become a Student** now shows LINE ID and photo read-only, pulled from the profile —
  like name/nickname/phone already were — instead of asking for them again. Edit
  Profile's "Student application" section dropped its now-redundant edit form entirely,
  showing only status text.
- Verified end-to-end on production (both Android via CDP and the website via
  Playwright): fields render and save correctly in Edit Profile for an already-approved
  account, Become a Student displays the same saved value read-only, and the Student
  application section shows no form. Zero console errors.

## 2026-08-08 (10) — Ad Hoc iOS distribution for devices TestFlight can't install on

- TestFlight itself requires iOS 16+ — unrelated to this app, which targets iOS 15+ —
  so a device stuck on an older iOS can't install TestFlight at all. Added an `adhoc`
  CI build target that bypasses TestFlight entirely: registers the device via the App
  Store Connect API (no manual Developer Portal clicking, just add it to
  `ADHOC_DEVICES` in `ios/fastlane/Fastfile`), builds a signed Ad Hoc `.ipa`, and
  publishes it to our own server at `https://wpusa.online/adhoc/` — opening the printed
  `itms-services://` link in Safari on the device installs it directly.
- New `/adhoc/` nginx location + volume mount on the production server for this — not
  linked from the public site, verified it doesn't affect the existing public site, api,
  or admin panel (all still return 200 after the nginx restart).
- The GitHub-hosted CI runner can't reach the server's SSH port at all (locked to
  specific IPs, doesn't include GitHub's ever-changing runner IPs — confirmed by a real
  "Operation timed out" failure), so publishing goes over HTTPS instead: a new
  token-gated `POST /internal/adhoc-upload/:filename` endpoint (`api/src/adhoc-upload/`)
  writes the uploaded `.ipa`/`manifest.plist` into the same server directory nginx
  serves. Verified directly: valid upload succeeds, wrong token → 401, disallowed
  filename → 400, uploaded file correctly serves back through `/adhoc/`.
- Needs a new `ADHOC_UPLOAD_TOKEN` GitHub secret (documented in `ios/SETUP.md`, value
  already generated and set on the server) before the `adhoc` target can run — not yet
  set on GitHub, since secrets can only be added by a repo admin through the GitHub UI.
- Fixed a 413 on the actual `.ipa` upload: nginx's default `client_max_body_size` (1MB)
  was far too small for an iOS app bundle. Added `client_max_body_size 200m;` to the
  `api.wpusa.online` server block. Verified with a real 5MB upload (201) plus confirmed
  no other server (public site, admin) was affected by the nginx reload.
- Fixed "address is invalid" when opening the raw `itms-services://` link: iOS Safari
  refuses that scheme typed/pasted directly into the address bar, it only reliably
  triggers from a link actually tapped on a page. CI now generates and uploads a tiny
  `install.html` landing page (styled Install button → same manifest.plist) alongside
  the `.ipa`; the Job Summary now points to that page's URL instead of the raw link.

## 2026-08-08 (9) — Fixed: page titles overlapping the iPhone status bar on every tab

- `.tab-content` (shared scroll container for Home/Events/Courses/Profile and everything
  nested under them — Edit profile, Apply student, My courses/certificates/rsvps/
  donations) had no top safe-area handling at all — only the bottom tab bar did. Each
  page's own flat 20px top padding wasn't enough to clear the status bar / Dynamic
  Island, so titles rendered underneath the clock/battery icons (e.g. "Events" overlapping
  the time). Fixed once at the shared container instead of patching every page.
- Verified no regression on Android (env() resolves to 0 there — screenshot confirms
  pixel-identical layout).
- Standalone pages with their own back button (Course/Event detail, Notifications,
  Attendance, Certificate received) already had this handled from an earlier fix and
  weren't touched, to avoid double-stacking the safe-area offset.

## 2026-08-08 (8) — Fixed the fix: web QR fallback still didn't open on a real iPhone

- The BarcodeDetector-based fallback from (7) still showed "Camera scanning isn't
  supported" on a real iPhone via TestFlight — turns out `BarcodeDetector` is undefined
  inside Capacitor's iOS WKWebView regardless of iOS version, even where Safari itself
  supports it. Replaced it with `jsqr`, a pure-JS decoder needing only `getUserMedia` +
  `<canvas>` (drawing video frames to an offscreen canvas each animation frame) — no
  browser API dependency at all. Verified the decode logic itself with a standalone
  Node round-trip (generate → decode a QR PNG through the same call the component uses).
  Still can't verify the live camera pipeline without a real device — next TestFlight
  build needs on-device confirmation.

## 2026-08-08 (7) — Fixed: QR check-in camera never opened on iOS

- Root cause: `@capacitor-mlkit/barcode-scanning` (used for native QR check-in scanning)
  only supports CocoaPods on iOS — Google's ML Kit SDK has no SPM distribution — but this
  project's iOS integration is pure SPM by design, so the native plugin was never actually
  linked into the iOS binary. `BarcodeScanner.startScan()` always threw there, silently.
- Now falls back to the existing browser-based camera scanner (Shape Detection API) when
  the native scan fails to start, which works on iOS 17+ without touching the native
  Xcode project. Android unaffected — its native plugin is properly linked and this path
  never triggers there; verified on-device.
- A proper permanent fix (adding CocoaPods back specifically for this plugin) is still an
  option if native ML Kit scanning UX is wanted on iOS — flagged as a follow-up, not done
  here since it requires Xcode to verify and none is available in this environment.

## 2026-08-08 (6) — Public-site (wpusa.online) now has the same profile editing as mobile

- New **My Account → Edit Profile** page (previously didn't exist on the website at all):
  read-only Email/Role, editable first/last name, nickname, phone; change password (self-
  registered accounts only); edit a pending student application's LINE ID and photo.
- **Become a Student** reworked to match mobile: email is now read-only (came from
  registration, was previously editable — the bug the user actually meant by "fix it on
  wpusa.online too"), name/nickname/phone are pulled from the account profile instead of
  re-typed, added an optional photo upload with the same styled file picker, and a
  pending application links to Edit Profile instead of duplicating an edit form.
- No backend changes needed — reuses the `/me` and `/me/student-application` endpoints
  already deployed for mobile.
- Verified end-to-end against production: register → Edit Profile save → Become a
  Student (profile-derived fields, photo picker) → submit → "Edit your application" link.
  Zero console errors.

## 2026-08-08 (5) — Fixed: new registrations couldn't get past the PIN screen

- `register.ts` sent brand-new accounts straight to `/home`, which the security gate then
  bounced to `/security/unlock` — a "confirm it's you" passcode screen with nothing to
  enter, since the account never had a PIN set. Registration was effectively a dead end
  on mobile. Fixed by mirroring `login.ts`'s existing logic: mark the gate unlocked and
  route first-time accounts to `/security/set-pin` instead. Verified on Android with a
  fresh account — now lands on "Set a PIN" as expected.

## 2026-08-08 (4) — Optional photo upload on Become a Student

- Applicants can attach a photo when applying to become a student, or skip it — reuses
  the existing generic `/uploads` endpoint and the same upload pattern as donation proof
  images. Editable later from Edit profile's Student application section while the
  application is still pending.
- New `photo_url` column on `student_applications`
  (migration `2026-08-08-add-student-application-photo.sql`).
- Admin panel's application review table (both list and card views) now shows the
  uploaded photo as a thumbnail, linking to the full image.
- Both backend and frontend now deployed to production and verified end-to-end on
  Android: profile save, password change, and application submit/edit all confirmed
  working against the live API.

## 2026-08-08 (3) — Users can now edit their own profile, password, and student application

- New **Profile → Edit profile** page (mobile) with three independent sections:
  - **Your details** — registered email shown read-only, plus editable first name, last
    name, nickname, phone number, backed by a new `PATCH /me` endpoint. Saves update the
    Profile header name/initials app-wide without re-login.
  - **Change password** — only shown for accounts that registered with email/password
    (`registrationSource === 'self'`); social-login accounts see a note to manage their
    password with that provider instead. Backed by a new `PATCH /me/password`, which
    verifies the current password before hashing the new one.
  - **Student application** — view and edit the details submitted when applying to become
    a student (name, nickname, phone, LINE ID), editable only while the application is
    still `pending`. Backed by a new `PATCH /me/student-application`.
- New `nickname` column on `users` (migration `2026-08-08-add-user-nickname.sql`).
- Verified on Android via CDP: page renders real data, conditional sections show/hide
  correctly, and client-side error handling surfaces backend errors cleanly.
- Follow-up: added a read-only **Role** field to Edit profile. Removed the duplicate
  name/nickname/phone editable fields from both **Become a student** and Edit profile's
  Student application section — they now read straight from the account profile above
  (shown read-only, with a note pointing to Edit profile to change them), so users no
  longer fill in the same details twice. Become a student's Email field is also read-only
  now (it comes from registration). Once an application is pending, its status card links
  straight to Edit profile instead of duplicating an edit form on the apply page.

## 2026-08-08 (2) — User-adjustable text size in Profile → Display

- Follow-up to (1) below. Every `font-size`/`font:` px value across the mobile app is now
  wrapped as `calc(Npx * var(--text-scale, 1))` instead of a plain px number, so a single
  CSS custom property rescales every font in the app at once. `--text-scale` defaults to
  `1`, matching (1)'s shipped baseline exactly — existing users see no change unless they
  opt into something different.
- New **Profile → Display → Text size** setting with four options (Small 0.85×, Normal
  1×, Large 1.15×, Extra large 1.3×). New `TextScaleService` applies the choice instantly
  (sets the CSS var on `<html>`) and persists it via Capacitor `Preferences`, restored on
  every app launch through a `provideAppInitializer` (same pattern as session restore) so
  it's already applied before the first page paints.
- Verified on Android: switching sizes rescales the whole UI live, and the choice survives
  a full app force-stop + relaunch.

## 2026-08-08 (1) — Mobile app text scaled up ~15%, this time without breaking anything

- Follow-up to (7) below, which used `zoom` and broke Cloudflare Turnstile + `100vh`
  pages. This time scaled every actual `font-size`/`font:` declaration across all 27
  `.scss` files in the mobile project by 1.15× (via a one-off script, not by hand —
  rounded to the nearest 0.5px), touching only text size, not box dimensions — so
  nothing needs to reflow/resize except the text itself wrapping a little more inside
  its existing box, which every layout here already tolerates (no fixed-height text
  containers). Verified on Android across Home, course detail, Login (Cloudflare
  Turnstile widget untouched, as expected — it's a cross-origin iframe, unaffected
  either way since nothing here scales boxes), and the PIN unlock screen (still fills
  the screen correctly, no `100vh` regression this time).

## 2026-08-06 (7) — Mobile app text/UI scale-up attempted, reverted — broke real pages

- Requested for elderly users. Tried `zoom: 1.15` on `html` (every font-size in the app
  is a fixed px value, not relative, so there's no single root size to bump that scales
  text alone without overflowing boxes — `zoom` scales everything, box included). Looked
  correct on Home and Login in initial testing, but broke on further testing: the
  Cloudflare Turnstile widget is a cross-origin iframe, whose own internal content isn't
  affected by the parent page's `zoom` the same way the iframe's own box is, so its
  rendered content came out mismatched/escaping its container; separately, pages sized
  with `100vh`/`100dvh` (PIN unlock, login, etc.) no longer filled the real screen after
  zoom, since those units measure the physical viewport, not the zoomed one. Reverted.
  Needs a different approach — likely a real per-component font-size increase (the
  correct but much larger-scope fix, since sizes are hardcoded px everywhere) rather than
  a single global scale.

## 2026-08-06 (6) — iOS: overlay back/close buttons overlapped the status bar clock

- The overlay-style back button (course/event detail hero) and photo viewer's close
  button used `top: max(16px, env(safe-area-inset-top))`. On notched iPhones this wasn't
  enough clearance — the button rendered under/overlapping the system status bar clock,
  making it untappable there. Changed to `calc(env(safe-area-inset-top, 44px) + 8px)`
  (a real status-bar-height fallback plus extra margin) on both.
- Also confirmed working end-to-end this session: iOS push notifications, verified by
  sending a real push directly from the server to the registered device's FCM token
  (bypassing the app entirely) and confirming it arrived.

## 2026-08-06 (5) — iOS: back button on Notifications did nothing, Apple button had no logo

- **Back button**: `<app-back-button>` called `Location.back()` unconditionally. When a
  page (e.g. Notifications, reached via a push notification tap) was the first
  navigation of the session, there was no history entry to pop, so the tap silently did
  nothing — looked broken. Now falls back to `/home` if the URL hasn't actually changed
  shortly after asking history to go back. Verified the normal case (Home → Notifications
  → back → Home) still works via live in-app navigation, not just the fallback path.
- **Apple sign-in button**: the button showed a blank black circle — `<span
  class="apple-icon">` was empty in the HTML with no CSS `content` or glyph ever defined
  to fill it, so there was never an actual logo mark on it (Apple-only bug since this
  button is gated to iOS: `Capacitor.getPlatform() === 'ios'`). Replaced with an inline
  SVG of the Apple logo mark.

## 2026-08-06 (4) — App version on Profile, fixed iOS push notifications

- Profile page now shows the installed app's version/build number (via
  `@capacitor/app`'s `getInfo()`, so it always reflects the real build rather than a
  hardcoded string — matters especially for iOS where the build number auto-increments
  per CI run).
- Push notifications never worked on iOS: `App.entitlements` never declared
  `aps-environment`, without which `registerForRemoteNotifications()` (called
  automatically by `@capacitor-firebase/messaging`'s iOS plugin) can't obtain a valid
  APNs token, so Firebase Messaging can never exchange it for an FCM token — everything
  else (Push Notifications capability, APNs key uploaded to Firebase, plugin wiring,
  backend) was already correctly configured. Set to `production` since `match` builds
  for App Store/TestFlight distribution, which always uses the production APNs
  environment.

## 2026-08-06 (3) — Disabled double-tap-to-zoom on iOS

- Repeated taps in quick succession (e.g. double-tapping a button) triggered
  Safari/WKWebView's built-in double-tap-to-zoom gesture on iOS, zooming the
  whole page in and making it hard to use — Android doesn't have this
  behavior. Added `maximum-scale=1, user-scalable=no` to the viewport meta
  tag (`index.html`) to disable pinch/double-tap zoom entirely, matching how
  a native app behaves.

## 2026-08-06 (2) — Fixed iOS login/Google sign-in: CORS rejected the app's real origin

- Login and Google/Facebook sign-in appeared to fail on iOS with a generic
  "Invalid email or password." / "Google sign-in failed." message, while the
  same credentials worked fine on Android. Root-caused via temporary debug
  logging (both client-side, showing the raw HTTP error, and server-side,
  logging every CORS origin seen) — confirmed the request actually reached
  the backend, which was rejecting it: the iOS WebView's `Origin` header is
  `capacitor://app.wpusa.online`, not `https://app.wpusa.online`.
- A prior fix (this session, `iosScheme: 'https'` in `capacitor.config.ts`,
  meant to make iOS match Android's already-fixed `androidScheme: 'https'`)
  did not actually change this in practice, even confirmed correctly present
  in the built app's `capacitor.config.json` — Capacitor's `iosScheme`
  config does not reliably control the WebView's actual request origin the
  way `androidScheme` does on Android. Rather than depend on a client-side
  fix that wasn't working, allowlisted `capacitor://app.wpusa.online`
  directly in the backend's CORS config (`api/src/main.ts`).
- All temporary debug logging (client error detail suffix, server origin
  console.log) removed once confirmed fixed via live server logs.

## 2026-08-06 (1) — Splash screen background now matches the PIN unlock screen

- Splash screen was plain black (`#000000`), while the PIN/login screen right
  after it uses the brand dark brown (`--w-dark` = `#241c15`) — created a
  visible flash/mismatch between the two on launch.
- Android: `android/app/src/main/res/values/colors.xml` `splash_background`
  changed to `#241c15`. iOS: `LaunchScreen.storyboard`'s imageView background
  color changed to match (was defaulting to white via `systemBackgroundColor`,
  only visible as edge letterboxing since the splash image itself fills via
  `scaleAspectFill`, but still worth matching).
- Verified on Android device via screenshot at launch.

## 2026-08-05 (19) — Missed the mobile Events tab in the image-crop fix

- (18) covered mobile's Home event grid and Event detail hero/gallery, but
  missed `pages/events/event-list/event-list.scss` — the actual Events tab
  list — which still had the old `height: 130px` + `cover` box. Applied the
  same `aspect-ratio: 4/3` + `position:absolute` fix there.
- Audited the rest of the mobile app for the same `height:Npx` + `object-fit:
  cover` pattern to check nothing else was missed; the two remaining hits
  (`qr-camera.scss`, `introduction.scss`) are a live camera preview and
  bundled onboarding art respectively, not admin-uploaded content, so left
  as-is.

## 2026-08-05 (18) — Extended full-image display fix to course/event/branch/team photos

**Deploy note:** (17) and (18) covered the public-site changes in code, but
public-site was never actually deployed to production after either commit —
`wpusa.online` kept serving pre-fix CSS (`event-card-img{height:130px}`,
no `aspect-ratio` anywhere) until this was caught and `public-site` was
rebuilt + `nginx_proxy` restarted. Confirmed live afterward via the deployed
CSS bundle content, not just container-up status.


- Extended (17)'s fix beyond banners to every other admin-uploaded image
  surface: course cards, event cards, course/event detail hero photos,
  course/event photo galleries, branch photos, and team headshots — all of
  these previously used a different fixed pixel height per surface (e.g.
  course cover shown at 120px in admin, 150px on public-site, 130px on
  mobile, 100px on mobile Home — four different crops of the same image),
  which is the same root cause as the banner bug.
- Card/thumbnail grids (course cards, event cards, branch cards, photo
  galleries) unified to a consistent `aspect-ratio` matching the admin's
  documented upload hint (4:3 for course/event/branch photos, 1:1 for team
  headshots) with `object-fit: cover` kept — minor, predictable cropping is
  expected/acceptable for compact grid thumbnails, but now every surface
  crops the *same* image consistently instead of each doing its own
  arbitrary crop.
- Single prominent "showcase" photos (course/event/branch detail-page hero)
  switched to `aspect-ratio: 2/1` + `object-fit: contain`, same treatment as
  the banner fix, so the full photo always shows (letterboxed if needed)
  rather than being cropped.
- Bug found and fixed along the way: `aspect-ratio` on a container combined
  with a plain `img { width:100%; height:100% }` child does not reliably
  compute layout on this device's older Android System WebView — the box
  collapses to the *image's own* natural aspect ratio instead of the CSS
  one (confirmed live via CDP: a `.hero` styled `aspect-ratio: 2/1` rendered
  at 411×617px, exactly matching its 1200×1800 source image, not 411×205).
  Fixed by switching every affected `img` to `position: absolute; inset: 0`
  inside a `position: relative` parent — the same pattern already used
  (and already known to work) for the carousel banner — which sizes off the
  parent's box directly instead of hitting the percentage-height/
  aspect-ratio interaction bug.
- Mobile's `course-detail.scss` component style grew past the Angular
  budget's hard error threshold (8kB) from these additions; raised
  `mobile`'s `anyComponentStyle` budget in `angular.json` from 4kB
  warn/8kB error to 8kB warn/10kB error, matching the threshold already
  used by `public-site` and `admin-panel`.

## 2026-08-05 (17) — Uploaded banner images no longer get cropped

- Home Banner (and the About page's banner carousel, same underlying pattern)
  displayed uploaded images cropped, because every surface used a different
  fixed pixel height (public-site desktop 420px, public-site mobile-web 220px,
  native mobile app 160px, About page 300px) combined with `object-fit: cover`.
  None of these boxes matched the ~16:5 ratio the admin upload hint suggests, so
  admin-uploaded promotional flyers (which are often dense with text/QR codes
  near the edges) had important content sliced off on most screens.
- Fix: replaced every fixed-height banner box with a responsive CSS
  `aspect-ratio` (16:5 desktop / 16:9 on narrower layouts) and switched
  `object-fit` from `cover` to `contain`, so the full uploaded image always
  shows — letterboxed against the existing `--w-bg-alt` background if its
  ratio doesn't exactly match, never cropped. Applied to: public-site Home
  (`pages/home/home.scss`), public-site About (`pages/about/about.scss`), and
  mobile Home (`pages/home/home.scss`).
- Scope note: this fix targets banner/promo-graphic carousels specifically
  (Home Banner, About banner) since those are admin-uploaded flyers where any
  cropping loses meaning. Photo-thumbnail surfaces elsewhere (course/event
  cover photos, branch/team photos) intentionally keep `object-fit: cover`
  cropping, which is the expected/normal behavior for photographic thumbnails.

## 2026-08-05 (16) — Home course cards: prerequisite lock moved onto the ribbon

- On Home's "Courses & programs" grid (card view), the "Requires <course>" text
  pill under the title was removed; a small 🔒 lock icon now appears at the top
  of the diagonal ribbon instead, on courses that have a prerequisite. Ribbon
  background switches to a gold→accent gradient for locked offerings so they
  stand out more against unlocked ones. List view (the row layout, no ribbon)
  and the standalone Courses page keep the existing text pill since they have
  no ribbon element to attach the icon to.

## 2026-08-05 (15) — Course ribbon shows city instead of branch name

- Mobile course cards (course-list, course-detail, and Home's "Courses & programs"
  carousel) showed the diagonal ribbon as `<branch name><date>`, e.g.
  "WILLPOWER INSTITUTE USA / JUN 3". Changed to show `<city><date>` instead, e.g.
  "Los Angeles / Jun 3", per request. Falls back to branch name if a branch has no
  city set (`o.branchCity || o.branchName`).
- Backend: `branches.city` existed in the DB but wasn't exposed by the public
  course-offerings endpoints. Added `branchCity` to `findPublicOfferings` and
  `findAllPublicOfferings` in `api/src/courses/courses.service.ts` (both SQL
  SELECT and response mapping), and threaded it through the mobile app's
  `PublicOffering` / `ApiPublicCourseOfferingCard` / `PublicCourseOfferingCard`
  interfaces in `public-course-api.service.ts`. Deployed to production
  (`api` commit `ecd5fe9`) — verified live via `curl` showing `branchCity` in the
  response before touching the mobile templates.
- Updated three templates: `course-list.html`, `course-detail.html`, and
  `home.html` — only the actual `.img-ribbon` / `.offering-ribbon` element was
  changed; adjacent subtitle lines that also print the branch name (e.g.
  `course-level`, `course-row-meta`) were deliberately left showing the branch
  name, not city — those are a different piece of UI, not the ribbon.
- Side effect: deploying this required pulling 2 pending commits to production,
  including a previously-undeployed Apple Sign-In backend feature from an earlier
  session — confirmed live afterward (`POST /auth/apple` now 401, was 404).

## 2026-08-05 (14) — Fix Prerequisite banner touching Class offerings section

- On mobile course-detail, the "Prerequisite" warning banner and the
  "Class offerings" heading below it had no visual gap — text was touching.
  Root cause: `.offerings-note` in `course-detail.scss` (reused across many
  states — prerequisite banner, login prompts, loading/error notes, "no open
  class times", donate login prompt) had `margin: 0`, so whichever state
  rendered last before the next section had nothing separating it.
- Fix: changed `.offerings-note` margin from `0` to `0 0 12px` — one shared
  rule, so it also fixed spacing for every other state reusing that class, not
  just the prerequisite banner.
- Checked `event-detail.scss`'s analogous `.rsvp-closed-note` (also `margin: 0`)
  — left unchanged, it's always the last element before card padding so there
  was no actual touching bug there.

## 2026-08-03 (13) — The real fix: native keyboard-height detection, not WebView APIs

- (12)'s "verified via live DevTools" fix was reported broken again minutes later. Root
  cause this time, found by live-testing the actual Phone-number donate field via CDP
  (clicking through the real form, focusing the real field, reading real DOM state — not
  a synthetic reproduction): `document.scrollingElement.style.paddingBottom` was correctly
  computed as `""` (no padding, correctly not needed), yet the field was still hidden
  behind the keyboard in the screenshot. `window.innerHeight` / `visualViewport.height`
  reported `773` — the *resting*, no-keyboard value — even with the keyboard fully open.
  In other words: on the actual test device (a Samsung Galaxy Note 9, Android 10 / API
  29), the WebView's own viewport measurement doesn't change *at all* when the keyboard
  opens, under any `windowSoftInputMode` tried. Confirmed this is a platform limitation,
  not a JS bug, by tracing why: `@capacitor/keyboard`'s modern `keyboardWillShow`/`Hide`
  events are dispatched from `WindowInsetsAnimationCompat`, which requires API 30+ and
  silently never fires on this API-29 device (confirmed empirically — installed the
  plugin, added a live listener, opened the keyboard on the real device: zero events).
  The plugin's older `resizeOnFullScreen` fallback was tried next and *also* measurably
  didn't resize the WebView's viewport on this device (same live-CDP check: still `773`
  with the keyboard open).
- Every avenue that depends on the WebView or a modern Android inset-dispatch API failed
  on this specific OS/OEM combination (Samsung's One UI on Android 10 has a
  known-inconsistent insets implementation). Fix: added a small amount of native Android
  code (`MainActivity.java`) using `ViewTreeObserver.OnGlobalLayoutListener` +
  `View.getWindowVisibleDisplayFrame()` — the ~2012-era technique that predates and
  doesn't depend on any of the above, reliable back to API 1 — to measure the keyboard's
  real height directly and dispatch it to JS as a plain `nativeKeyboardHeightChange`
  window event. `windowSoftInputMode` set to `adjustPan` (nothing auto-resizes, so
  `window.innerHeight` reliably stays the true, untouched, full-page height for the "what's
  covered" math). Removed `@capacitor/keyboard` again (its events genuinely don't fire on
  this device, so keeping it installed but unused would be dishonest scaffolding).
- Verified with live values, not just visuals: the native event now fires with real
  numbers (`keyboardHeight: 334`, `visible: true` — not `0`, not the previous bogus `70`),
  confirmed via a live event listener attached through Chrome DevTools while operating the
  actual donate form and course-rating "Optional note" field (the two fields explicitly
  reported broken) on the real device — 8+ open/close cycles across both fields, all
  clean, with the native event log and on-screen result cross-checked together each time.

## 2026-08-03 (12) — Verified via live DevTools inspection, not screenshots

- After (11) was reported still broken, stopped guessing and connected
  Chrome DevTools directly to the running WebView on the test device
  (`adb forward` to the `webview_devtools_remote_*` socket + a raw CDP
  `Runtime.evaluate` client) to read real values instead of inferring
  from screenshots. Found: on this device, `visualViewport.height`
  genuinely and deterministically drops to a very small value when the
  keyboard opens (not a transient/racy reading — identical across
  every cycle), and `course-detail`/`event-detail` are top-level
  routes *outside* the tab shell (`app.routes.ts`), so they scroll via
  `document.scrollingElement`/`<html>`, never `.tab-content` — an
  earlier debugging pass had wrongly assumed `.tab-content` applies
  almost everywhere. Added a short debounce (settle on the value 120ms
  after the last resize event, re-reading the live property rather
  than trusting a value snapshotted at event time) as defense against
  any future timing variance. Verified with 11 consecutive open/close
  cycles while polling `document.scrollingElement.style.paddingBottom`
  live in the running page: padding applied/cleared correctly in sync
  with the real keyboard state on every single cycle, no exceptions.

## 2026-08-03 (11) — Follow-up: keyboard-height calc raced window.innerHeight

- (10)'s scroll-parent fix was correct but a second bug was hiding
  behind it: `keyboardHeight` was computed as `window.innerHeight -
  visualViewport.height`, and under real `adjustResize` those two
  don't reliably update in the same tick — `innerHeight` could still
  report the taller pre-resize value at the exact instant the
  `visualViewport` "resize" event fired, inflating the computed
  keyboard height. That padding then never self-corrected (a one-shot
  event with nothing left to fire once things settled), leaving a
  blank gap sized like whatever the race happened to produce —
  intermittent, matching the "sometimes there, sometimes not" reports.
  Replaced the `innerHeight` diff with a self-tracked "last known
  keyboard-closed height" baseline that resets every time the keyboard
  closes, removing the dependency on `innerHeight`'s timing entirely.
  Verified with 4 back-to-back open/close cycles on the same field
  (course rating's Optional note) with no gap on any cycle.

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
