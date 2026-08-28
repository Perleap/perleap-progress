import fs from 'fs';
import path from 'path';
import {
  authStatePath,
  loadVerifyEnv,
  loadSandboxFixture,
  evidenceDirForRun,
  makeRunId,
  writeManifest,
  fail,
  parseArgs,
  SKILL_ROOT,
} from './shared.mjs';
import { getFeature, runFeature } from '../features/registry.mjs';
import { openBrowserContext, closeBrowserContext } from '../abilities/browser-context.mjs';

const args = parseArgs(process.argv.slice(2));
const featureId = args.id;
const runId = args.run ?? makeRunId();

if (!featureId) {
  fail('Usage: node drive-feature.mjs --id <feature-id> [--run <run-id>]');
}

const env = loadVerifyEnv();
const fixture = loadSandboxFixture();
const baseURL = env.VERIFY_BASE_URL;
const feature = getFeature(featureId);

if (!feature) {
  fail(`Unknown feature id "${featureId}"`);
}

if (feature.role !== 'anonymous') {
  const authPath = authStatePath(feature.role);
  if (!fs.existsSync(authPath)) {
    fail(`Missing auth for ${feature.role}. Run: npm run verify:login -- --role ${feature.role}`);
  }
}

async function main() {
  const evidenceDir = evidenceDirForRun(runId);
  const { browser, page } = await openBrowserContext({ role: feature.role, env });

  let result;
  try {
    result = await runFeature(featureId, {
      page,
      env,
      fixture,
      evidenceDir,
      abilityArgs: args,
      role: feature.role,
    });
  } catch (err) {
    await page.screenshot({
      path: path.join(evidenceDir, `${featureId}-failure.png`),
      fullPage: true,
    });
    throw err;
  }

  const screenshotPath = path.join(evidenceDir, `${featureId}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  writeManifest(evidenceDir, {
    runId,
    featureId,
    role: feature.role,
    baseURL,
    finalUrl: page.url(),
    proof: result.proof,
    data: result.data ?? null,
    screenshot: path.relative(SKILL_ROOT, screenshotPath),
    timestamp: new Date().toISOString(),
  });

  await closeBrowserContext({ browser, env });
  console.log(`verify-perleap: feature ${featureId} OK`);
  console.log(`verify-perleap: evidence → ${evidenceDir}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
