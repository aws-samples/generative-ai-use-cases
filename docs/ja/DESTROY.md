# リソースの削除方法

デプロイ方法に応じて、以下のコマンドを実行してください。**Cognito UserPool, DynamoDB Table など全てのデータが削除されます。**

```bash
# cdk.json の context.env で指定した環境を削除
npm run cdk:destroy

# parameter.ts で設定した環境を削除 (以下の例では 'prod')
npm run cdk:destroy -- -c env=prod
```

> [!NOTE]
> デプロイ時と削除時の cdk.json (parameter.ts) の値が異なると、上記コマンドを実行しても特定のスタックが削除されない場合があります。
> マネジメントコンソールの CloudFormation の画面 (modelRegion および cdk deploy を実行したリージョン) にて、関連するスタックが残っていないことを確認して下さい。

## エラーになった場合

以下のようなエラーが発生することがあります。

> **The bucket you tried to delete is not empty. You must delete all versions in the bucket.**

S3 Bucket は削除する時に中身を空にする必要があります。AWS CDK のオプションで `autoDeleteObjects: true` を指定することで、削除の前に中身を自動で空にできるのですが、空にしてから実際に削除するまでの間に新たなファイルが追加されることで、上記エラーが発生します。

このエラーが発生した場合は、以下の手順に従って手動で Stack を削除してください。

1. [AWS CloudFormation](https://console.aws.amazon.com/cloudformation/home) を開き、GenerativeAiUseCasesStack を選択。
1. Delete を押下。この際に削除に失敗した S3 Bucket の削除をスキップするか聞かれるため、チェックを入れて削除を実行。
1. 削除をスキップした S3 Bucket を除いたリソースの削除が完了する。
1. [Amazon S3](https://s3.console.aws.amazon.com/s3/home) を開き、スキップした S3 Bucket を探す。("generative" 等で検索してください。)
1. Empty (Bucket を空にする) => Delete (Bucket を削除する) を実行
