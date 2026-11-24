import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'tamp', 'dist');
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.map', '.mjs', '.svg', '.txt', '.webmanifest', '.xml',
]);
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/i;
const SERVER_SECRET_NAME = /\b(?:SUPABASE_SERVICE_ROLE_KEY|FCM_SERVICE_ACCOUNT|VAPID_PRIVATE_KEY|CRON_SECRET|TMDB_API_KEY)\b/i;
const JWT = /\b(eyJ[A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{2,})\.([A-Za-z0-9_-]{8,})\b/g;

export function findExposedSecrets(source) {
  const findings = [];

  if (PRIVATE_KEY.test(source)) findings.push('private key material');
  if (SERVER_SECRET_NAME.test(source)) findings.push('server secret identifier');

  for (const match of source.matchAll(JWT)) {
    try {
      const payload = JSON.parse(Buffer.from(match[2], 'base64url').toString('utf8'));
      if (payload?.role === 'service_role') {
        findings.push('Supabase service_role JWT');
        break;
      }
    } catch {
      // Ignore strings that only resemble JWTs but have an invalid payload.
    }
  }

  return [...new Set(findings)];
}

function* textFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* textFiles(file);
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) yield file;
  }
}

export function scanBuild(directory = buildDir) {
  const problems = [];
  let scanned = 0;

  for (const file of textFiles(directory)) {
    const content = readFileSync(file);
    if (content.includes(0)) continue;
    scanned += 1;
    const findings = findExposedSecrets(content.toString('utf8'));
    for (const finding of findings) {
      problems.push({ file: path.relative(root, file).replace(/\\/g, '/'), finding });
    }
  }

  return { scanned, problems };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const { scanned, problems } = scanBuild();
  if (problems.length) {
    for (const { file, finding } of problems) console.error(`::error file=${file}::${finding} detectado en el bundle`);
    process.exitCode = 1;
  } else {
    console.log(`Sin secretos de servidor en los bundles (${scanned} archivos de texto inspeccionados).`);
  }
}
