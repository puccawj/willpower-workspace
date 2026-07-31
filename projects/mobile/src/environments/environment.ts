export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  // Same public Client ID / App ID as the backend's GOOGLE_CLIENT_ID / FACEBOOK_APP_ID env vars.
  // Leave blank to hide the corresponding "Continue with..." button.
  googleClientId: '415889498195-n64sb80ht9osvb14lv6v3k5tonl354js.apps.googleusercontent.com',
  // TODO(iOS): create an "iOS" type OAuth client in Google Cloud Console (separate from
  // the Web client above) and paste its Client ID here — required for native Google
  // sign-in on iOS. Google login on iOS silently fails until this is filled in.
  googleIosClientId: '',
  facebookAppId: '1031348352734699',
  // Required by @capgo/capacitor-social-login's native Facebook SDK init (the web apps'
  // SDK loader never needed this). Get it from Meta App Dashboard > Settings > Advanced.
  // Facebook login silently fails on-device until this is filled in.
  facebookClientToken: '1a57926f61b69dc24276d072a50cd5b5',
  // Site key from https://dash.cloudflare.com/?to=/:account/turnstile — matches the backend's
  // TURNSTILE_SECRET_KEY. Leave blank to skip rendering the CAPTCHA widget.
  turnstileSiteKey: '0x4AAAAAAD36IRqrhNUwqbgt',
};
