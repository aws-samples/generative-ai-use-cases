# Update Method

GenU is frequently updated.
In addition to feature additions and improvements, security-related updates may also be included, so we recommend regularly updating to the latest release and redeploying.

Each release is published as a Git tag (for example `v5.6.0`) with release notes on the [Releases page](https://github.com/aws-samples/generative-ai-use-cases/releases).
The main branch also contains changes that are not released yet, so we recommend deploying a release rather than the main branch.

If you are using the [Deployment Method Using AWS CloudShell](./DEPLOY_ON_CLOUDSHELL.md), you can update by simply running `deploy.sh` again as it deploys the latest release by default. (The following steps are not necessary.)

## Manual Update Process

This is the method for users to update themselves.

### Check the release notes

Before updating, read the release notes of every release between your current version and the new one on the [Releases page](https://github.com/aws-samples/generative-ai-use-cases/releases).
If a release contains a breaking change (for example, a resource that is replaced or deleted, or a setting that is removed or renamed), the release notes describe its impact and the migration steps.

You can check your current version with the following command:

```bash
git describe --tags
```

### Merge the latest release

This assumes you have already cloned the repository and completed the initial deployment.
If you have changed files such as [cdk.json](/packages/cdk/cdk.json) or [parameter.ts](/packages/cdk/parameter.ts), commit them to your branch first.

Retrieve the releases and merge the latest one into your branch with the following commands:

```bash
git fetch --tags origin
git merge $(git describe --tags --abbrev=0 origin/main)
```

To update to a specific release, specify its tag instead:

```bash
git merge v5.6.0
```

If you have no commits of your own, the merge is a fast-forward and your code matches the release.
If you have your own commits, Git creates a merge commit and opens an editor for the commit message. To keep the default message, add `--no-edit`:

```bash
git merge --no-edit v5.6.0
```

If you previously updated by pulling the main branch, your code may already contain changes that are newer than the latest release.
In that case, the merge above changes nothing, and the next release brings your code back in line with a release.

### If you customize in a different repository

If you are customizing in a different repository (for example, a fork), the remote may be registered under a different name.
You can check the remote with the following command:

```bash
git remote -v
```

In the example output below, the repository managed by the aws-samples Organization (the original repository) is registered with the name "aws".

```
origin  https://my-private-git-hosting-site.com/myawesomeorg/generative-ai-use-cases (fetch)
origin  https://my-private-git-hosting-site.com/myawesomeorg/generative-ai-use-cases (push)
aws     https://github.com/aws-samples/generative-ai-use-cases (fetch)
aws     https://github.com/aws-samples/generative-ai-use-cases (push)
```

In this case, explicitly specify "aws":

```bash
git fetch --tags aws
git merge $(git describe --tags --abbrev=0 aws/main)
```

If the `git remote -v` result does not show the repository managed by aws-samples, add it with the following command:

```bash
git remote add aws https://github.com/aws-samples/generative-ai-use-cases
```

Merging a release tag works the same way as merging the main branch at that point, so you can keep your customizations on your own branch and merge each release into it.
If you only need specific changes, you can also cherry-pick their commits from the main branch.

### If you want to see changes before incorporating them

To check the changes before merging, compare your code with the release:

```bash
git diff HEAD v5.6.0
```

### If conflicts occur

If conflicts occur during the merge, it means that both your customized code and the original changes were made to the same file simultaneously.
Code with conflicts needs to be manually fixed.

Pay special attention to conflicts in [cdk.json](/packages/cdk/cdk.json).
**Always check after the merge to ensure that the items you configured locally have not been lost.**

Do not resolve conflicts in `package-lock.json` by hand. Take the upstream version and regenerate it:

```bash
git checkout --theirs package-lock.json
npm install
git add package-lock.json
```

### Moving settings from cdk.json to parameter.ts

When an environment is defined in `envs` in [parameter.ts](/packages/cdk/parameter.ts), the parameters in [cdk.json](/packages/cdk/cdk.json) are not used for that environment, and every parameter that parameter.ts leaves out takes its default value. When you move your settings:

- Move every parameter you changed from its default in cdk.json. A parameter you leave out goes back to its default. For example, leaving out `ragKnowledgeBaseEnabled: true` deletes the Knowledge Base stack.
- Keep the environment name (`env`). It is part of the stack names, so a different name creates new stacks. If you deploy without `-c env=`, define the environment as `''`.
- parameter.ts already defines `dev`, `staging` and `prod`, empty. If you deploy with one of these names, the parameters in cdk.json are already not used.
- After moving, run `npm run cdk:diff` and check that it shows the same changes as before the move. Then redeploy.

### Troubleshooting

| Message                                                                   | Cause and fix                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Your local changes to the following files would be overwritten by merge` | You have uncommitted changes. Commit them to your branch with `git commit`, or set them aside with `git stash`, then merge again.                                                                                                  |
| `CONFLICT (content): Merge conflict in ...`                               | See [If conflicts occur](#if-conflicts-occur). To cancel the merge and start over, run `git merge --abort`. It restores the state before the merge.                                                                                |
| `merge: v5.6.0 - not something we can merge`                              | The tag has not been fetched, or the tag name is wrong. Run `git fetch --tags origin` (or the name of your remote) and check the tag name on the [Releases page](https://github.com/aws-samples/generative-ai-use-cases/releases). |
| `fatal: No names found, cannot describe anything.`                        | The repository was cloned without history (for example with `git clone --depth 1`), so it has no tags. Run `git fetch --tags --unshallow origin`, then try again.                                                                  |
| `Already up to date.`                                                     | Your code already contains this release, or a newer state of the main branch. This is not an error.                                                                                                                                |
| `fatal: destination path 'generative-ai-use-cases' already exists`        | A directory with the same name already exists. Update in the existing directory, or clone into another directory (`git clone <URL> <directory>`).                                                                                  |

You can also ask an AI coding assistant such as Kiro to resolve conflicts. In that case too, always check after the merge that the settings you made in [cdk.json](/packages/cdk/cdk.json) and [parameter.ts](/packages/cdk/parameter.ts) are still there.

### Using the main branch

If you need a change that is not released yet, you can merge the main branch instead of a release:

```bash
git fetch origin
git merge origin/main
```

The main branch can contain changes that are not described in release notes yet, including breaking changes.

### Redeploy

Basically, follow the steps in [README.md](/README.md), but Bootstrap is not necessary.
Since packages may have been updated, please run the `npm ci` command:

```bash
npm ci
npm run cdk:deploy
```

## Automating Updates

There are also ways to automate updates in AWS.
The following article introduces a method to update with just two clicks on GitHub by integrating with AWS CodePipeline:  
[Update GenU at Lightning Speed! One-Click Update Technique with AWS CodePipeline](https://qiita.com/moritalous/items/9ade46091a60030415e0) by [@moritalous](https://x.com/moritalous)
