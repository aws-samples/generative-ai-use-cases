## Local Environment Setup Procedure

This explains the procedure for setting up a local environment for developers. Note that even when setting up a local environment, [deployment to AWS](/README.md#deployment) must be completed.

### (Recommended) Users with Unix-based commands (Cloud9, Linux, MacOS, Windows WSL/Bash/Git Bash, etc.)

By executing the following command, necessary environment variables will be dynamically retrieved from CloudFormation Output and the server will be started.
Note that this internally uses the `aws` and `jq` commands, so please install them before execution if they are not already installed.

```bash
npm run web:devw
```

> [!TIP] > [Default profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html#cli-configure-files-using-profiles) is used for AWS authentication.
> If you want to use a different profile or access key for authentication, set the environment variables in advance or add them to [setup-env.sh](/setup-env.sh).
>
> ```bash
> export AWS_PROFILE=''
> export AWS_DEFAULT_REGION=''
> ```

> [!TIP]
> If you want to switch and use a different backend environment, change the context.env in cdk.json or specify it as a command line argument like `npm run web:devw --env=dev2`.

### Windows Users

For Windows users, we have prepared a PowerShell script `web_devw_win.ps1` to set up the development environment, which can be launched with `web:devww` (with one extra `w`). This script is similar to `setup-env.sh` but adapted for PowerShell, requiring the `aws` command but not `jq`.

```bash
npm run web:devww
```

If executed successfully, it will start at http://localhost:5173, so please try accessing it from your browser. AWS profiles can be specified with `-profile`, but when specifying arguments on Windows, please enclose `--` in single quotes like `npm run web:devww '--' -profile dev`. This is a known issue with `npm` ([Issue 3136](https://github.com/npm/cli/issues/3136#issuecomment-2632044780)).

### Other Users

It is also possible to set environment variables manually. However, due to the large number of variables, the `npm run web:devw` method described above is generally recommended.
If setting manually, create an `.env` file at `/packages/web/.env` and set the environment variables as follows:

```bash
VITE_APP_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/
VITE_APP_REGION=ap-northeast-1
### Remaining variables omitted ###
```

For the necessary environment variables and their values, please refer to [`setup-env.sh`](/setup-env.sh) and the CloudFormation Output values (in the management console).
Once the environment variables are set, run the following command:

```bash
npm run web:dev
```

If executed successfully, it will start at http://localhost:5173, so please try accessing it from your browser.

## When Submitting a Pull Request

We welcome Pull Requests for bug fixes and feature improvements :tada:

When `git commit` is executed, `npm run lint` is executed. But if it fails, the commit causes an error like the following:

```bash
⚠ Running tasks for staged files...
  ❯ package.json — 1 file
    ❯ **/* — 1 file
      ✖ sh -c 'npm run lint' [FAILED]
      ...
```

If you want to ignore this error and create a Draft PR, add the `--no-verify` option as shown below.

```bash
git commit -m "xxx" --no-verify
```

Also, if there are changes to the CDK, check the snapshots with the following command and update them:

```bash
# Check differences
npm run cdk:test

# Update tests
npm run cdk:test:update-snapshot
```
