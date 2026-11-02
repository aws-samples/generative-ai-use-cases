// Usage (from packages/cdk): ts-node scripts/destructive-guard/synth.ts <outdir>
//
// Synthesizes every profile in profiles.ts into <outdir>/<profile>/, the same
// way the snapshot test does: in process and without asset bundling, so no
// Docker or AWS credentials are needed.
import * as cdk from 'aws-cdk-lib';
import {
  BUNDLING_STACKS,
  DISABLE_ASSET_STAGING_CONTEXT,
} from 'aws-cdk-lib/cx-api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getParams } from '../../parameter';
import { createStacks } from '../../lib/create-stacks';
import { PROFILES } from './profiles';

const outRoot = process.argv[2];
if (!outRoot) {
  console.error('usage: synth.ts <outdir>');
  process.exit(2);
}

const cdkJson = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'cdk.json'), 'utf8')
) as { context?: Record<string, unknown> };

for (const [name, overrides] of Object.entries(PROFILES)) {
  const app = new cdk.App({
    outdir: join(outRoot, name),
    context: {
      ...cdkJson.context,
      ...overrides,
      [BUNDLING_STACKS]: [],
      [DISABLE_ASSET_STAGING_CONTEXT]: true,
    },
  });
  createStacks(app, getParams(app));
  app.synth();
  console.log(`synthesized profile ${name}`);
}
