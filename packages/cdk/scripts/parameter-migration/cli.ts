// Usage (from packages/cdk): ts-node scripts/parameter-migration/cli.ts --env <name>
//
// Prints, as JSON, which source getParams() reads for the environment and,
// when it is cdk.json, the parameters to move into parameter.ts. Use '' for
// the anonymous environment (deployed without -c env=...). Changes no files.
import * as cdk from 'aws-cdk-lib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getParams } from '../../parameter';
import { extractParameters, parameterSource } from './extract';

const [flag, env] = process.argv.slice(2);
if (flag !== '--env' || env === undefined) {
  console.error('usage: cli.ts --env <name>');
  process.exit(2);
}

const cdkJson = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'cdk.json'), 'utf8')
) as { context?: Record<string, unknown> };
const context = cdkJson.context ?? {};

const source = parameterSource({
  context,
  env,
  resolve: (ctx) => getParams(new cdk.App({ context: ctx })),
});

const result =
  source === 'parameter.ts'
    ? { env, source }
    : { env, source, ...extractParameters({ context: { ...context, env } }) };

console.log(JSON.stringify(result, null, 2));
