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

## Also required before the app will build correctly

1. **App ID** — create `org.willpowerinstitute.app` in Apple Developer Portal → Identifiers,
   with capabilities: **Push Notifications**, **Sign In with Apple**.
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
   with **bootstrap_certs = true**, once. This generates the signing certificate and
   pushes it (encrypted) to your `MATCH_GIT_URL` repo.
3. Trigger it again with bootstrap_certs = false (the default) — this builds the app
   and uploads it to TestFlight. Internal testers can install it immediately, no
   Apple review needed for that.
