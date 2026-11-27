export type MigrateArgs = {
  mode: 'migrate';
  table: string;
  /** Region of the table and the user pool (the main stack's region). */
  tableRegion: string;
  fileBucket: string;
  /** Region of the file bucket (the main stack's region). */
  region: string;
  userPoolId: string;
  userPoolRegion: string;
  agentCoreBucket?: string;
  agentCoreRegion?: string;
  includeSharedKeys: boolean;
  apply: boolean;
  report?: string;
  /** Where --apply saves the earlier value of every record it changes. */
  backup?: string;
};

export type RestoreArgs = {
  mode: 'restore';
  table: string;
  tableRegion: string;
  /** A backup file written by --apply. */
  restore: string;
};

export type Args = MigrateArgs | RestoreArgs;

const USAGE = `usage: cli.ts --table <name> --file-bucket <name> --region <region>
  --user-pool-id <id> [--agent-core-bucket <name> --agent-core-region <region>]
  [--include-shared-keys] [--report <path>] [--apply [--backup <path>]]
   or: cli.ts --table <name> --region <region> --restore <backup file>`;

const VALUE_OPTIONS = new Set([
  'table',
  'file-bucket',
  'region',
  'user-pool-id',
  'agent-core-bucket',
  'agent-core-region',
  'report',
  'backup',
  'restore',
]);
const FLAGS = new Set(['apply', 'include-shared-keys']);

const fail = (message: string): never => {
  throw new Error(`${USAGE}\n${message}`);
};

export const parseArgs = (argv: string[]): Args => {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`unexpected: ${arg}`);
    const name = arg.slice(2);
    if (FLAGS.has(name)) {
      flags.add(name);
    } else if (VALUE_OPTIONS.has(name)) {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) {
        fail(`--${name} needs a value`);
      }
      values[name] = value;
    } else {
      fail(`unknown option --${name}`);
    }
  }

  if (values.restore !== undefined) {
    for (const required of ['table', 'region']) {
      if (!values[required]) fail(`--${required} is required`);
    }
    const others = Object.keys(values).filter(
      (n) => !['table', 'region', 'restore'].includes(n)
    );
    if (others.length > 0 || flags.size > 0) {
      fail('--restore takes only --table and --region');
    }
    return {
      mode: 'restore',
      table: values.table,
      tableRegion: values.region,
      restore: values.restore,
    };
  }

  for (const required of ['table', 'file-bucket', 'region', 'user-pool-id']) {
    if (!values[required]) fail(`--${required} is required`);
  }
  if (values['agent-core-bucket'] && !values['agent-core-region']) {
    fail('--agent-core-region is required with --agent-core-bucket');
  }
  if (values.backup && !flags.has('apply')) {
    fail('--backup is used only with --apply');
  }
  const userPoolRegion = values['user-pool-id'].split('_')[0];
  return {
    mode: 'migrate',
    table: values.table,
    tableRegion: userPoolRegion,
    fileBucket: values['file-bucket'],
    region: values.region,
    userPoolId: values['user-pool-id'],
    userPoolRegion,
    agentCoreBucket: values['agent-core-bucket'],
    agentCoreRegion: values['agent-core-region'],
    includeSharedKeys: flags.has('include-shared-keys'),
    apply: flags.has('apply'),
    report: values.report,
    backup: values.backup,
  };
};
