import fs from 'fs';
import {
  loadVerifyEnv,
  loadSandboxFixture,
  authStatePath,
  fail,
  parseArgs,
} from './shared.mjs';
import { runAbilityByName, getAllAbilities } from '../features/registry.mjs';
import { openBrowserContext, closeBrowserContext } from '../abilities/browser-context.mjs';

const args = parseArgs(process.argv.slice(2));
const name = args.name;

if (!name) {
  fail(`Usage: node run-ability.mjs --name <ability>\nKnown: ${getAllAbilities().join(', ')}`);
}

const env = loadVerifyEnv();
const fixture = loadSandboxFixture();
const fetchOnly = name === 'fetchClassroom' || name === 'fetchAssignment';

async function main() {
  if (fetchOnly) {
    const result = await runAbilityByName(name, { env, fixture, abilityArgs: args, page: null });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const ability =
    (await import('../abilities/complete-chat-assignment.mjs')).getAbility(name);
  if (!ability) fail(`Ability ${name} requires browser but was not found`);

  const authPath = authStatePath(ability.role);
  if (!fs.existsSync(authPath)) {
    fail(`Missing auth for ${ability.role}. Run verify:login -- --role ${ability.role}`);
  }

  const { browser, page } = await openBrowserContext({ role: ability.role, env });
  try {
    const result = await runAbilityByName(name, { page, env, fixture, abilityArgs: args });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowserContext({ browser, env });
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
