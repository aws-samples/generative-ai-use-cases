---
name: genu-update
description: Update a deployed GenU (generative-ai-use-cases) to a newer release. Use when updating, upgrading or merging a new GenU version or release tag into a customized branch or fork, checking breaking changes or resource replacements before redeploying, resolving merge conflicts in cdk.json, parameter.ts or package-lock.json, or moving deployment parameters from cdk.json to parameter.ts.
license: MIT-0
compatibility: Requires git, Node.js with the repository dependencies installed (npm ci), Docker, and AWS credentials with read access to CloudFormation in the deployment account (the same environment used to deploy GenU).
---

# Update GenU to a newer release

Help the user move their GenU deployment to a newer release without losing
their customizations or their data. GenU releases are git tags such as
`v5.6.0`; release notes are on the
[Releases page](https://github.com/aws-samples/generative-ai-use-cases/releases).
`docs/en/UPDATE.md` is the user-facing version of this procedure.

## Rules

- Never run `cdk deploy`, `cdk destroy`, `git push --force`, `git reset --hard`
  or `git clean` unless the user explicitly asks for that exact action.
- Do all trial work in a separate git worktree. Do not change the user's
  branch until they approve the result.
- If `cdk diff` shows that a resource holding data would be replaced or
  deleted, stop and show it. Continue only after the user decides.
- Ask before every commit. Keep each change (update, parameter migration) in
  its own commit.

## Steps

### 1. Check the current state

1. Run `git status`. If there are uncommitted changes, ask the user to commit
   or stash them first.
2. Find the current release with `git describe --tags`.
3. Find the remote that points to `aws-samples/generative-ai-use-cases` with
   `git remote -v`. In a fork it is often not `origin`. If none exists, offer
   `git remote add aws https://github.com/aws-samples/generative-ai-use-cases`.
   Call it `<remote>` below.
4. Ask how the user deploys, for example `npm run cdk:deploy -- -c env=prod`,
   and in which AWS account and region. Note the environment name (`<env>`;
   empty when there is no `-c env=`) and any other `-c` options. Every
   `cdk diff` below must use the same options and credentials.

### 2. Choose the target release

1. Run `git fetch --tags <remote>`.
2. The latest release is the `tag_name` of
   `https://api.github.com/repos/aws-samples/generative-ai-use-cases/releases/latest`.
   Use it unless the user names another tag (`<tag>` below).
3. Read the release notes of every release after the current one up to
   `<tag>`, and list the commits with `git log --oneline <current>..<tag>`.
   Summarize for the user:
   - breaking changes and their migration steps (commit subjects marked
     `[Breaking Change]`, and notes that mention removed or renamed
     parameters or replaced resources)
   - parameters that were added, removed or renamed
     (`git diff <current> <tag> -- packages/cdk/lib/stack-input.ts`)

### 3. Merge in a trial worktree

```bash
git worktree add -b genu-update/<tag> ../genu-update-trial HEAD
cd ../genu-update-trial
git merge --no-edit <tag>
```

If the merge stops with conflicts, resolve them with the user by following
`references/conflicts.md`. Then run `npm ci` in the trial worktree.

### 4. Check the impact

Run `cdk diff` in the trial worktree against the deployed stacks and review
it by following `references/impact-check.md`.

Report the result in plain terms: which stacks and resources would be
added, replaced or deleted, and what data the replaced or deleted ones hold.
If anything that holds data is replaced or deleted, stop here and point the
user at the migration steps from step 2.

### 5. Apply the update

After the user approves:

```bash
cd <user's checkout>
git merge --ff-only genu-update/<tag>
npm ci
```

The fast-forward brings in the trial merge, including the conflict
resolutions. Then show the deploy command the user gave in step 1. Run it
only if the user asks.

### 6. Offer the parameter migration (optional)

If the user's parameters come from `cdk.json`, suggest moving them to
`parameter.ts`. Benefits: TypeScript checks parameter names and types (a
misspelled key in `cdk.json` is silently ignored), and later updates rarely
conflict in `cdk.json`. Follow `references/parameter-migration.md`. If the
user declines, skip it.

The migration is a separate commit and must not change what `cdk diff`
reports.

### 7. Clean up

```bash
git worktree remove ../genu-update-trial
git branch -d genu-update/<tag>
```
