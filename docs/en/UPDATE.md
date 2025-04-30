# Update Method

GenU is frequently updated.
In addition to feature additions and improvements, security-related updates may also be included, so we recommend regularly pulling from the main branch of the repository and redeploying.

If you are using the [Deployment Method Using AWS CloudShell](./DEPLOY_ON_CLOUDSHELL.md), you can update by simply running `deploy.sh` again as it always deploys the latest main branch. (The following steps are not necessary.)

## Manual Update Process

This is the method for users to update themselves.

### Pull the main branch

This assumes you have already cloned the repository and completed the initial deployment.
To pull the contents of the main branch, execute the following command:

```bash
git pull
```

If you are customizing in a different repository, the remote may be registered under a different name.
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

In this case, explicitly specify "aws" when pulling:

```bash
git pull aws
```

If the `git remote -v` result does not show the repository managed by aws-samples, add it with the following command:

```bash
git remote add aws https://github.com/aws-samples/generative-ai-use-cases
```

Now that it's registered with the name "aws", execute `git pull aws` to perform the pull.

### If you want to see changes before incorporating them

The `git pull` command performs both `git fetch` (retrieve changes) and `git merge` (incorporate changes) simultaneously.
If you want to check the changes before incorporating them, execute `fetch` and `merge` separately.
In the following commands, we assume that [aws-samples/generative-ai-use-cases](https://github.com/aws-samples/generative-ai-use-cases) is registered as "origin" in the remote.
To check the remote name, run the `git remote -v` command mentioned earlier.

First, retrieve the changes with the following command:

```bash
git fetch origin
```

Next, check the differences between your local code and origin/main:

```bash
git diff origin/main
```

If there are no issues, execute the merge:

```bash
git merge origin/main
```

### If conflicts occur

If conflicts occur during `git pull`, it means that both your customized code and the original changes were made to the same file simultaneously.
Code with conflicts needs to be manually fixed.

Pay special attention to conflicts in [cdk.json](/packages/cdk/cdk.json).
**Always check after `git pull` to ensure that the items you configured locally have not been lost.**

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
