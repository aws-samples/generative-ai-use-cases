# Resolving merge conflicts

Show each conflict to the user before resolving it. The user's
customizations win unless the release notes say the upstream change is
required.

## packages/cdk/cdk.json

- Keep every parameter value the user set. Take new keys and new CDK feature
  flags (`@aws-cdk/...`) from upstream.
- If upstream removed or renamed a parameter (check
  `git diff <current> <tag> -- packages/cdk/lib/stack-input.ts`), move the
  user's value to the new name, or drop it and tell the user.
- After resolving, confirm that the file is valid JSON and that none of the
  user's values were lost: compare `git show HEAD:packages/cdk/cdk.json` with
  the result.

## packages/cdk/parameter.ts

Keep the user's environment entries in `envs`. Take upstream changes to the
rest of the file.

## package-lock.json

Do not edit it by hand. Take the upstream version and regenerate it, which
also brings back dependencies the user added in `package.json`:

```bash
git checkout --theirs package-lock.json
npm install
git add package-lock.json
```

## Customized source code

For conflicts in `packages/web` or `packages/cdk/lib`, explain both sides
and let the user choose. If the upstream change is a security fix (see the
release notes), recommend keeping it.

After all conflicts are resolved, finish the merge with `git commit
--no-edit`.
