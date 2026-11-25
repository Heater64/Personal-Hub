import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const moduleUrl = new URL('../api/tamp-media.js', import.meta.url).href;

function inspectConfiguration(environment) {
  const source = `
    import { configCloudinary } from ${JSON.stringify(moduleUrl)};
    const { v2: cloudinary } = await import('cloudinary');
    const config = configCloudinary();
    if (config.cloudName !== 'sample-cloud' || config.apiKey !== 'sample-key' || cloudinary.config().api_secret !== 'sample-secret') {
      process.exit(2);
    }
    console.log('configured');
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    env: { ...process.env, CLOUDINARY_URL: '', CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '', ...environment },
  });
}

test('api/tamp-media reads Vercel CLOUDINARY_URL through the official SDK config', () => {
  const result = inspectConfiguration({ CLOUDINARY_URL: 'cloudinary://sample-key:sample-secret@sample-cloud' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'configured');
  assert.doesNotMatch(result.stdout, /sample-secret/);
});

test('split Cloudinary environment variables remain supported', () => {
  const result = inspectConfiguration({
    CLOUDINARY_CLOUD_NAME: 'sample-cloud',
    CLOUDINARY_API_KEY: 'sample-key',
    CLOUDINARY_API_SECRET: 'sample-secret',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'configured');
  assert.doesNotMatch(result.stdout, /sample-secret/);
});
