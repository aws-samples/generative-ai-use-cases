# Impact check with cdk diff

Goal: find out, before deploying, what the update changes in the user's own
deployment, and above all whether it replaces or deletes a resource that
holds data.

## Run cdk diff

In the trial worktree, with the user's credentials and region:

```bash
npm run cdk:diff -- -c env=<env> > ../genu-update-diff.txt 2>&1
```

Add the user's other `-c` options. Omit `-c env=` when the user deploys
without it. `cdk diff` compares the synthesized templates with the deployed
stacks; it needs read access to CloudFormation and makes no changes.
Synthesis bundles the Lambda functions, so Docker must be running, the same
as for a deploy.

If it fails with an access error, check with the user that the credentials
point to the deployment account and region. Do not continue without the
diff.

## Read the output

`cdk diff` prints one section per stack. In the `Resources` part:

- `[+]` the resource is added
- `[-]` the resource is deleted
- `[~]` the resource is modified; `requires replacement` or
  `may be replaced` means it is deleted and created again
- A stack that exists in the account but is no longer synthesized does not
  appear. Compare the stack names in the output with the deployed stacks
  (`aws cloudformation list-stacks`) and report any that would be left
  behind or removed.

Resources that hold data. Report every `[-]` and every replacement of these
types as a blocker:

- `AWS::DynamoDB::Table`, `AWS::DynamoDB::GlobalTable`
- `AWS::S3::Bucket`, `AWS::S3Vectors::VectorBucket`, `AWS::S3Vectors::Index`
- `AWS::Cognito::UserPool`, `AWS::Cognito::IdentityPool`
- `AWS::KMS::Key`, `AWS::SecretsManager::Secret`
- `AWS::Kendra::Index`
- `AWS::Bedrock::KnowledgeBase`, `AWS::Bedrock::DataSource`
- `AWS::OpenSearchServerless::Collection`
- `AWS::EC2::VPC`

Changes to Lambda functions, IAM roles and policies, API Gateway and the web
app (`Custom::CDKNodejsBuild`) are expected in an update. Summarize them, but
they are not blockers. `Custom::CDKNodejsBuild ... may be replaced` appears on
almost every diff: it rebuilds the web app and holds no data. Mention IAM changes that broaden permissions
(`IAM Statement Changes` with `+`).

For each blocker, look for the reason in the release notes and the commits
from step 2, and tell the user what data would be lost and whether the
release notes give a migration path.
