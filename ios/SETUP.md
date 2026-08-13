# iOS build — one-time setup

The GitHub Actions workflow (`.github/workflows/ios-build.yml`) builds and uploads to
TestFlight on a free macOS runner — no Mac needed on your end. Before the first run,
set these as **GitHub repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Where to get it |
|---|---|
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect → Users and Access → Keys → Generate API Key |
| `APP_STORE_CONNECT_ISSUER_ID` | Same page, shown above the keys table |
| `APP_STORE_CONNECT_KEY_CONTENT` | The downloaded `.p8` file, base64-encoded: `base64 -i AuthKey_XXXX.p8 \| pbcopy` (Mac) or `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXX.p8"))` (PowerShell) |
| `APPLE_DEVELOPER_TEAM_ID` | developer.apple.com → Account → Membership details |
| `APP_STORE_CONNECT_TEAM_ID` | App Store Connect → scroll to bottom of any page, or Users and Access |
| `MATCH_GIT_URL` | URL of a new **private** GitHub repo you create (e.g. `https://github.com/puccawj/willpower-ios-certs.git`) — this is where your encrypted signing certificate gets stored, never in this repo |
| `MATCH_PASSWORD` | Any passphrase you make up — encrypts the certificate before it's pushed to the certs repo |
| `MATCH_GIT_BASIC_AUTHORIZATION` | Required because the certs repo above is private and `actions/checkout` only authenticates the main repo, not other ones `match` needs to `git clone`. Create a GitHub **classic** Personal Access Token (Settings → Developer settings → Personal access tokens → Generate new token (classic), scope: `repo`), then base64-encode `<github-username>:<token>` — e.g. `printf '%s' "puccawj:ghp_xxxx" \| base64` (Mac/Linux) or `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("puccawj:ghp_xxxx"))` (PowerShell) |
| `APPETIZE_API_TOKEN` | Optional — only needed to test builds in-browser via [appetize.io](https://appetize.io) without an iPhone. Get it from your Appetize account (Settings → API). Every run uploads a simulator build and prints a test link in the run's Job Summary. |
| `ADHOC_UPLOAD_TOKEN` | Only needed for the **adhoc** build target (below). A random string (already generated and set as `ADHOC_UPLOAD_TOKEN` in the production server's `.env` — copy the same value here so CI can authenticate to it: `POST /internal/adhoc-upload/:filename` on the API, gated by this token). Not an SSH key — the GitHub-hosted runner's IP can't reach the server's SSH port at all (it's locked to specific IPs, confirmed by a real "Operation timed out" failure), so this uploads over HTTPS to the API instead. |

## Also required before the app will build correctly

1. **App ID** — create `org.willpowerinstitute.app` in Apple Developer Portal → Identifiers,
   with capability: **Push Notifications**. (Sign In with Apple was removed from the app —
   no capability needed for it.)
2. **APNs key** — Developer Portal → Keys → create one with "Apple Push Notifications
   service" enabled, then upload it in Firebase Console → Project Settings → Cloud
   Messaging → Apple app configuration. Without this, push notifications silently fail
   to reach iOS devices even though the same backend code already works for Android.
3. **Google Sign-In (iOS)** — create an "iOS" type OAuth client in Google Cloud Console
   (separate from the existing Web client), then fill in:
   - `projects/mobile/src/environments/environment.ts` and `environment.prod.ts`:
     `googleIosClientId`
   - `ios/App/App/Info.plist`: the `com.googleusercontent.apps.REPLACE_ME` URL scheme
     (use the **reversed** client ID)
4. **Facebook (iOS)** — in Meta App Dashboard, add an iOS platform to the existing app
   and register bundle ID `org.willpowerinstitute.app`. No code changes needed — the
   App ID/Client Token are already filled into `Info.plist`.

## First run

1. Set all the secrets above.
2. Manually trigger the workflow (Actions tab → iOS build → TestFlight → Run workflow)
   with **build_target = bootstrap_certs**, once. This generates the signing certificate
   and pushes it (encrypted) to your `MATCH_GIT_URL` repo.
3. Trigger it again with build_target = testflight (the default) — this builds the app
   and uploads it to TestFlight. Internal testers can install it immediately, no
   Apple review needed for that.

## Ad Hoc builds (for devices that can't install TestFlight)

TestFlight's own app requires iOS 16+ to install — a device stuck on an older iOS (this
app's own minimum is iOS 15) can't get it at all, regardless of anything in this repo.
Ad Hoc bypasses TestFlight entirely: the signed `.ipa` installs straight from a link
opened in Safari, hosted on our own server instead of Apple's.

1. Add the device: edit `ADHOC_DEVICES` in `ios/fastlane/Fastfile` with its name + UDID
   (get the UDID by visiting udid.tech in Safari **on the device itself** and installing
   the small profile it offers — no Mac or cable needed).
2. Trigger the workflow with **build_target = adhoc**. This registers the device via the
   App Store Connect API, regenerates the Ad Hoc provisioning profile to cover it,
   builds, and uploads the `.ipa` + `manifest.plist` + a tiny `install.html` landing
   page over HTTPS to `api.wpusa.online/internal/adhoc-upload/` (token-gated — see
   `api/src/adhoc-upload/`), which writes them into `~/willpower/adhoc-dist/` on the
   production server, served at `https://wpusa.online/adhoc/` (a location added to
   `nginx/default.conf` on the server specifically for this, not linked from the public
   site).
3. Open the run's Job Summary for the `https://wpusa.online/adhoc/install.html` link —
   open that **in Safari on the registered device** (must be Safari) and tap **Install**.
   iOS Safari generally refuses `itms-services://` links typed or pasted directly into
   the address bar, so this page exists purely to give it a real link to tap instead.

Re-running with build_target = adhoc for a later code change re-uses the same device
list and overwrites the same `.ipa`/manifest on the server — the install link doesn't
change, so testers just re-open it to get the latest build.
