# メンテナンスモード

メンテナンスモードを有効にすると、再デプロイせずに画面全体をお知らせに差し替えられます。
環境に手を入れている間や、費用を抑えるために新しい利用を止めたいときに使います。

## 有効にする

フラグはビルド成果物と同じ場所に置かれた `maintenance.json` の 1 ファイルだけです。

```bash
# 配信に使っているディストリビューションとバケットを調べる
WEB_URL=$(aws cloudformation describe-stacks \
  --stack-name GenerativeAiUseCasesStack<env> \
  --query 'Stacks[0].Outputs[?OutputKey==`WebUrl`].OutputValue' --output text)
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?DomainName=='${WEB_URL#https://}'].Id" --output text)
ORIGIN=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" \
  --query 'Distribution.DistributionConfig.Origins.Items[0].DomainName' --output text)
BUCKET=${ORIGIN%%.s3.*}

# メンテナンスモードを有効にする
echo '{"maintenance": true}' > /tmp/maintenance.json
aws s3 cp /tmp/maintenance.json "s3://$BUCKET/maintenance.json" \
  --content-type application/json
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths /maintenance.json
```

インバリデーションは必須です。既定のキャッシュポリシーでは最大 1 日エッジに残るため、
オブジェクトを上書きするだけでは切り替わりません。

既定の文言の代わりに表示するメッセージを指定できます。

```json
{ "maintenance": true, "message": "10:00 JST に再開します" }
```

## 無効にする

```bash
echo '{"maintenance": false}' > /tmp/maintenance.json
aws s3 cp /tmp/maintenance.json "s3://$BUCKET/maintenance.json" \
  --content-type application/json
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths /maintenance.json
```

## 閉域モードの場合

閉域モードでは、画面は CloudFront ではなく ALB から S3 のバケットを経由して配信されます。
キャッシュがないため、インバリデーションは不要です。バケットだけを調べて上書きします。

```bash
BUCKET=$(aws cloudformation describe-stack-resources \
  --stack-name ClosedNetworkStack<env> \
  --query "StackResources[?ResourceType=='AWS::S3::Bucket' && contains(LogicalResourceId, 'WebBucket')].PhysicalResourceId" \
  --output text)

echo '{"maintenance": true}' > /tmp/maintenance.json
aws s3 cp /tmp/maintenance.json "s3://$BUCKET/maintenance.json" \
  --content-type application/json
```

## デプロイし直すと元に戻ります

`maintenance.json` はビルド成果物の一部なので、`npm run cdk:deploy` で画面をデプロイし直すと、
リポジトリにある `{"maintenance": false}` に戻ります。メンテナンス中にデプロイする場合は、
デプロイの後にもう一度有効にしてください。

## 動作

- フラグは起動時、その後 60 秒ごと、およびタブが再表示されたときに取得されます。
  開いたままのタブも自動的に切り替わります。
- **取得に失敗した場合はすべて「メンテナンス中ではない」として扱います。**
  1 回の通信失敗で全員が締め出される方が影響が大きいため、通信エラー・200 以外の応答・
  JSON でない本文のいずれでも、アプリケーションはそのまま利用できます。
- フラグを `.json` にしているのは意図的です。Service Worker のプリキャッシュ対象は
  `js` / `css` / `html` / `ico` / `png` / `svg` のみのため、この取得は必ずネットワークに出ます。
  すでに PWA をインストールしている利用者にも反映されます。

## 制限

メンテナンスモードが止めるのは画面であって API ではありません。API を直接呼び出す利用者には
影響しないため、強制ではなくお知らせとして扱ってください。
モデルへのリクエストを確実に止めたい場合（費用の上限を設けたい場合など）は、
API 側も AWS WAF のルールなどで併せてブロックしてください。
