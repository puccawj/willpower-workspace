export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  googleClientId: '415889498195-n64sb80ht9osvb14lv6v3k5tonl354js.apps.googleusercontent.com',
  facebookAppId: '1031348352734699',
  // Site key from https://dash.cloudflare.com/?to=/:account/turnstile — matches the backend's
  // TURNSTILE_SECRET_KEY. Leave blank to skip rendering the CAPTCHA widget.
  turnstileSiteKey: '0x4AAAAAAD36IRqrhNUwqbgt',
};
