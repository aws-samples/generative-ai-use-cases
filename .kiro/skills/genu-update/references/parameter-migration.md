# Moving parameters from cdk.json to parameter.ts

## How getParams() reads parameters

`packages/cdk/parameter.ts` reads parameters from one source only:

- If `envs` in `parameter.ts` has an entry for the environment, that entry is
  used and **the parameters in `cdk.json` are ignored**. Every parameter the
  entry leaves out falls back to the schema default in
  `packages/cdk/lib/stack-input.ts`.
- Otherwise the parameters in `cdk.json` are used.

Consequences for the migration:

1. **Move every non-default value, not only the ones the user remembers.** A
   missing `ragKnowledgeBaseEnabled: true`, for example, turns the
   Knowledge Base off and deletes its stack on the next deploy.
2. **Keep the environment name.** The name is part of the stack names.
   Deployed without `-c env=`: use the `''` entry. Deployed with
   `-c env=prod`: use `prod`. A different name creates new stacks.
3. **`dev`, `staging` and `prod` already exist in `envs`, empty.** A user who
   deploys with one of these names already uses `parameter.ts`, and their
   `cdk.json` parameters have no effect. Do not offer the migration then; tell
   the user what is in effect.

## Procedure

Run in the user's checkout, after the update has been applied (step 5), with
the same credentials as the impact check. The `ts-node` commands run in
`packages/cdk`; `npm run cdk:diff` runs in the repository root.

1. Check the source and extract the values:

   ```bash
   cd packages/cdk
   npx ts-node scripts/parameter-migration/cli.ts --env '<env>'
   ```

   - `"source": "parameter.ts"`: nothing to migrate. Stop.
   - `"source": "cdk.json"`: `values` lists the parameters to move, as
     written in `cdk.json`. `unknownKeys` lists keys that are neither GenU
     parameters nor CDK settings; they have no effect today, usually because
     of a typo. Show them to the user and ask what was intended. Do not carry
     them over silently.

2. Explain the change and ask for approval. Show the values that will move.

3. Record the current diff against the deployed stacks:

   ```bash
   cd ../..   # repository root
   npm run cdk:diff -- -c env=<env> > ../genu-diff-before.txt 2>&1
   ```

4. Edit the files:
   - Add an entry `'<env>': { ... }` to `envs` in `parameter.ts` with exactly
     the extracted `values`. If the entry already exists (for `''`, it is
     commented out), replace it.
   - Restore the parameters in `cdk.json` to the release defaults:
     `git show <tag>:packages/cdk/cdk.json > cdk.json`. If the user changed
     non-parameter settings in `cdk.json` (keys under `context` that start
     with `@aws-cdk` or `aws-cdk:`, or `app`), put those back.

5. Verify:

   ```bash
   (cd packages/cdk && npx ts-node scripts/parameter-migration/cli.ts --env '<env>')   # now "source": "parameter.ts"
   (cd packages/cdk && npx tsc --noEmit)
   npm run cdk:diff -- -c env=<env> > ../genu-diff-after.txt 2>&1
   diff ../genu-diff-before.txt ../genu-diff-after.txt
   ```

   The raw output also contains bundling logs and asset hashes that change
   between runs; compare the `Stack` sections, not the whole file.

   The two diffs must report the same changes. One difference is expected:
   the web build (`Custom::CDKNodejsBuild`) uploads the repository including
   `cdk.json`, so its source object key changes and the web app is rebuilt on
   the next deploy. Any other difference means a value was lost or changed.
   Then restore both files with `git checkout -- parameter.ts cdk.json` and
   report which resources differed.

6. Ask to commit `parameter.ts` and `cdk.json` together in one commit.
