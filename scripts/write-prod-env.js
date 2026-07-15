// Generates each project's environment.prod.ts from environment variables at build time,
// so Vercel's dashboard env vars (Settings -> Environment Variables) control the deployed
// apiUrl/googleClientId/facebookAppId without needing a code change + commit to update them.
// Falls back to the value already committed in the file when a var isn't set, so a plain
// `ng build` still works locally without any env vars configured.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const PROJECTS = ['public-site', 'admin-panel'];

function readCurrent(filePath, key) {
  const src = fs.readFileSync(filePath, 'utf8');
  const match = src.match(new RegExp(`${key}:\\s*'([^']*)'`));
  return match ? match[1] : '';
}

for (const project of PROJECTS) {
  const filePath = path.join(root, 'projects', project, 'src', 'environments', 'environment.prod.ts');

  const apiUrl = process.env.API_URL || readCurrent(filePath, 'apiUrl');
  const googleClientId = process.env.GOOGLE_CLIENT_ID || readCurrent(filePath, 'googleClientId');
  const facebookAppId = process.env.FACEBOOK_APP_ID || readCurrent(filePath, 'facebookAppId');

  const contents = `export const environment = {
  production: true,
  // AWS server (no HTTPS yet, causes mixed-content errors from this HTTPS site): http://47.130.132.126:3000
  apiUrl: '${apiUrl}',
  googleClientId: '${googleClientId}',
  facebookAppId: '${facebookAppId}',
};
`;

  fs.writeFileSync(filePath, contents);
  console.log(`[write-prod-env] ${project}: apiUrl=${apiUrl}`);
}
