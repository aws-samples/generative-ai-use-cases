# Maintenance Mode

Maintenance mode replaces the whole application with a notice, without redeploying.
Use it while you are working on the environment, or to stop people from starting new
work when costs need to be contained.

## Turning it on

The flag lives in a single file, `maintenance.json`, next to the built assets.

```bash
# Look up the distribution and the bucket that serve the web assets
WEB_URL=$(aws cloudformation describe-stacks \
  --stack-name GenerativeAiUseCasesStack<env> \
  --query 'Stacks[0].Outputs[?OutputKey==`WebUrl`].OutputValue' --output text)
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?DomainName=='${WEB_URL#https://}'].Id" --output text)
ORIGIN=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" \
  --query 'Distribution.DistributionConfig.Origins.Items[0].DomainName' --output text)
BUCKET=${ORIGIN%%.s3.*}

# Turn maintenance mode on
echo '{"maintenance": true}' > /tmp/maintenance.json
aws s3 cp /tmp/maintenance.json "s3://$BUCKET/maintenance.json" \
  --content-type application/json
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths /maintenance.json
```

The invalidation is required. The default cache policy keeps the file at the edge for up
to a day, so overwriting the object alone is not enough.

You can add a message that is shown instead of the default text:

```json
{ "maintenance": true, "message": "Back at 10:00 JST" }
```

## Turning it off

```bash
echo '{"maintenance": false}' > /tmp/maintenance.json
aws s3 cp /tmp/maintenance.json "s3://$BUCKET/maintenance.json" \
  --content-type application/json
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths /maintenance.json
```

## Closed network mode

In closed network mode the web assets are served from an S3 bucket through an ALB, not
CloudFront. Nothing is cached, so no invalidation is needed. Look up the bucket and overwrite
the file.

```bash
BUCKET=$(aws cloudformation describe-stack-resources \
  --stack-name ClosedNetworkStack<env> \
  --query "StackResources[?ResourceType=='AWS::S3::Bucket' && contains(LogicalResourceId, 'WebBucket')].PhysicalResourceId" \
  --output text)

echo '{"maintenance": true}' > /tmp/maintenance.json
aws s3 cp /tmp/maintenance.json "s3://$BUCKET/maintenance.json" \
  --content-type application/json
```

## A deployment turns it off

`maintenance.json` is part of the build output, so deploying the web app again with
`npm run cdk:deploy` puts back the `{"maintenance": false}` from the repository. If you deploy
during maintenance, turn it on again after the deployment.

## How it behaves

- The flag is fetched when the application starts, every 60 seconds after that, and
  whenever the tab becomes visible again. Open tabs therefore switch over on their own.
- **Any failure is treated as "not under maintenance".** A single failed request should
  not lock everyone out, so a network error, a non-200 response or a body that is not
  JSON all leave the application usable.
- The flag is a `.json` on purpose. The service worker precache only covers
  `js`, `css`, `html`, `ico`, `png` and `svg`, so this request always reaches the network
  instead of being served from the cache of an already installed PWA.

## Limitations

Maintenance mode stops the user interface, not the API. Someone who calls the API
directly is unaffected, so treat it as a notice rather than as an enforcement mechanism.
If you need to guarantee that no request reaches the model - to cap spend, for example -
block the API as well, for instance with an AWS WAF rule on the API.
