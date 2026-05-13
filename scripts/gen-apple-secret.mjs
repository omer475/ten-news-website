#!/usr/bin/env node
// Generates an Apple "Sign in with Apple" client secret JWT (ES256).
// Required by Supabase's Apple provider — paste the printed JWT into the
// "Secret Key (for OAuth)" field of Supabase Auth → Providers → Apple.
//
// Usage:
//   node scripts/gen-apple-secret.mjs <path-to-.p8> <TEAM_ID> <KEY_ID> <BUNDLE_ID> [days]
//
// Example:
//   node scripts/gen-apple-secret.mjs ~/Downloads/AuthKey_ABCD1234EF.p8 \
//        S6W6YX4V2M ABCD1234EF com.tennews.app
//
// Defaults to 180 days (Apple's maximum). After expiry, regenerate + paste
// the new secret into Supabase.

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { resolve } from 'node:path';

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function derToJoseEs256(derSig) {
  // openssl gives ECDSA signatures in DER format. JWTs (RFC 7515) require
  // them concatenated as r||s (64 bytes for P-256). Convert here.
  let offset = 0;
  if (derSig[offset++] !== 0x30) throw new Error('Bad DER: expected sequence');
  // Length byte(s)
  let len = derSig[offset++];
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | derSig[offset++];
  }
  if (derSig[offset++] !== 0x02) throw new Error('Bad DER: expected integer r');
  let rLen = derSig[offset++];
  let r = derSig.slice(offset, offset + rLen); offset += rLen;
  if (derSig[offset++] !== 0x02) throw new Error('Bad DER: expected integer s');
  let sLen = derSig[offset++];
  let s = derSig.slice(offset, offset + sLen);
  // Strip leading zero / left-pad to 32 bytes
  const pad = (b) => {
    if (b.length === 32) return b;
    if (b.length === 33 && b[0] === 0x00) return b.slice(1);
    if (b.length < 32) return Buffer.concat([Buffer.alloc(32 - b.length), b]);
    throw new Error(`Unexpected integer length: ${b.length}`);
  };
  return Buffer.concat([pad(r), pad(s)]);
}

function main() {
  const [, , p8Path, teamId, keyId, bundleId, daysArg] = process.argv;
  if (!p8Path || !teamId || !keyId || !bundleId) {
    console.error('usage: node scripts/gen-apple-secret.mjs <.p8 path> <TEAM_ID> <KEY_ID> <BUNDLE_ID> [days]');
    process.exit(2);
  }
  const days = Math.min(parseInt(daysArg ?? '180', 10), 180);
  const now = Math.floor(Date.now() / 1000);

  const privateKey = readFileSync(resolve(p8Path), 'utf8');
  const header = { alg: 'ES256', kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + days * 24 * 60 * 60,
    aud: 'https://appleid.apple.com',
    sub: bundleId,
  };

  const signingInput =
    b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));

  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const derSig = signer.sign(privateKey);
  const joseSig = derToJoseEs256(derSig);
  const jwt = signingInput + '.' + b64url(joseSig);

  console.log('--- Apple client secret JWT (paste into Supabase) ---');
  console.log(jwt);
  console.log('');
  console.log(`Expires: ${new Date((now + days * 86400) * 1000).toISOString()} (${days} days)`);
}

main();
