#!/usr/bin/env node
/**
 * Provision disposable QA identities in Everneed-staging only.
 * Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
 * Passwords go only to .qa/staging-qa-credentials.json (mode 0600), gitignored.
 */
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const STAGING_REF = 'vjiadqygpyebpisxslbx';
const DEFAULT_OUTPUT = '.qa/staging-qa-credentials.json';
const users = [
  { key: 'buyer', email: 'qa-buyer@qa.everneed.invalid', name: 'Everneed QA Buyer', profileRole: 'customer', accessNote: 'Buyer flows' },
  { key: 'seller', email: 'qa-seller@qa.everneed.invalid', name: 'Everneed QA Seller', profileRole: 'merchant', accessNote: 'Seller/store owner flows' },
  { key: 'seller2', email: 'qa-seller2@qa.everneed.invalid', name: 'Everneed QA Seller 2', profileRole: 'merchant', accessNote: 'Multi-seller fixtures' },
  { key: 'dispatch', email: 'qa-dispatch@qa.everneed.invalid', name: 'Everneed QA Dispatch', profileRole: 'customer', accessNote: 'Await explicit scoped dispatcher assignment' },
  { key: 'support', email: 'qa-support@qa.everneed.invalid', name: 'Everneed QA Support', profileRole: 'customer', accessNote: 'Await explicit scoped support assignment' },
  { key: 'admin', email: 'qa-admin@qa.everneed.invalid', name: 'Everneed QA Admin', profileRole: 'admin', accessNote: 'Restricted staging-only legacy admin test identity' },
  { key: 'logistics', email: 'qa-logistics@qa.everneed.invalid', name: 'Everneed QA Logistics', profileRole: 'customer', accessNote: 'Await explicit hub/logistics assignment' },
];

const dryRun = process.argv.includes('--dry-run');
const outputPath = resolve(process.env.QA_CREDENTIALS_FILE || DEFAULT_OUTPUT);
const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

function requireStagingUrl(url) {
  if (!url) throw new Error('SUPABASE_URL is required.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('SUPABASE_URL is not a valid URL.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== STAGING_REF + '.supabase.co') {
    throw new Error('Refusing to run: expected the exact Everneed-staging host ' + STAGING_REF + '.supabase.co.');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('SUPABASE_URL must be the project root URL without paths, query, or fragment.');
  }
}

function makePassword() {
  return randomBytes(32).toString('base64url');
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const key = options.key;
  const body = options.body;
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method === 'POST' && path.startsWith('/rest/v1/') ? { Prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const detail = typeof data === 'object' && data ? (data.message || data.msg || data.error_description || data.error) : data;
    throw new Error(method + ' ' + path + ' failed (' + response.status + '): ' + (detail || 'request rejected'));
  }
  return data;
}

async function listUsers() {
  const found = [];
  for (let page = 1; page <= 20; page++) {
    const result = await request('/auth/v1/admin/users?page=' + page + '&per_page=100', { key: serviceKey });
    const batch = result?.users || [];
    found.push(...batch);
    if (batch.length < 100) break;
  }
  return found;
}

async function saveCredentialFile(accounts) {
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
  await writeFile(outputPath, JSON.stringify({
    created_at: new Date().toISOString(),
    project_ref: STAGING_REF,
    warning: 'STAGING QA ONLY. Keep private. Rotate/delete before production launch. Not for repository or PR comments.',
    accounts,
  }, null, 2), { mode: 0o600 });
  await chmod(outputPath, 0o600);
}

if (dryRun) {
  requireStagingUrl(baseUrl);
  console.log('DRY RUN — staging host verified. No network or user changes.\n' +
    users.map(u => u.key + ': ' + u.email + ' (profile role ' + u.profileRole + ')').join('\n'));
  process.exit(0);
}

requireStagingUrl(baseUrl);
if (!serviceKey || !anonKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are required. Never place these in source files.');
}

const existing = await listUsers();
const credentials = [];
let failed = false;

for (const qa of users) {
  try {
    const user = existing.find(u => (u.email || '').toLowerCase() === qa.email.toLowerCase());
    const pass = makePassword();
    const payload = {
      email: qa.email,
      password: pass,
      email_confirm: true,
      user_metadata: { qa_fixture: true, qa_label: qa.key },
    };
    const authUser = user
      ? await request('/auth/v1/admin/users/' + user.id, { method: 'PUT', key: serviceKey, body: payload })
      : await request('/auth/v1/admin/users', { method: 'POST', key: serviceKey, body: payload });

    const id = authUser?.user?.id || authUser?.id;
    if (!id) throw new Error('Auth Admin response did not include user ID.');

    const credentialIndex = credentials.push({
      key: qa.key,
      email: qa.email,
      password: pass,
      user_id: id,
      profile_role: qa.profileRole,
      access_note: qa.accessNote,
      verified_sign_in: false,
      created_or_reset: user ? 'password_reset' : 'created',
    }) - 1;
    await saveCredentialFile(credentials);

    // Profiles use the authorized service-role REST path; no direct auth.users SQL.
    await request('/rest/v1/profiles?on_conflict=id', {
      method: 'POST',
      key: serviceKey,
      body: { id, name: qa.name, email: qa.email, role: qa.profileRole },
    });

    // Verify actual password sign-in; discard session tokens and never log them.
    await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      key: anonKey,
      body: { email: qa.email, password: pass },
    });

    credentials[credentialIndex].verified_sign_in = true;
    await saveCredentialFile(credentials);
    console.log('✓ ' + qa.key + ': provisioned and sign-in verified');
  } catch (error) {
    failed = true;
    console.error('✗ ' + qa.key + ': ' + error.message);
  }
}

if (credentials.length) {
  await saveCredentialFile(credentials);
  console.log('\nCredentials saved securely to ' + outputPath + ' (mode 0600). Passwords were not printed.');
}
if (failed) process.exitCode = 1;
