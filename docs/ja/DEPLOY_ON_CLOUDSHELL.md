# AWS CloudShell を利用したデプロイ方法 (手元の環境を用意することが難しい場合)

## デプロイオプションの設定方法

GenU では以下の2つの方法でデプロイオプションを指定できます：

1. cdk.json の context での指定
2. parameter.ts での指定（複数環境の設定を定義できるため、新規に構築する場合は parameter.ts での指定を推奨）

利用可能なデプロイオプションについては [デプロイオプション](./DEPLOY_OPTION.md) をご参照ください。

### cdk.json での設定

[デフォルトの cdk.json](/packages/cdk/cdk.json) をダウンロード (GitHub ページ右上のダウンロードボタンからファイルをダウンロードできます) し、context 以下を変更してファイルを保存してください。

### parameter.ts での設定

[デフォルトの parameter.ts](/packages/cdk/parameter.ts) をダウンロードし、必要な環境設定を追加してください。parameter.ts では dev、staging、prod など複数の環境設定を1つのファイルで管理できます。

## CloudShell の起動

[CloudShell](https://console.aws.amazon.com/cloudshell/home) を起動します。
cdk.json や parameter.ts をカスタマイズした場合は、右上 Actions の Upload file からカスタマイズしたファイルをアップロードしてください。

## deploy.sh のダウンロードと実行権限の付与

CloudShell 上で以下のコマンドを実行し、`deploy.sh` というスクリプトをダウンロードします。
また、ダウンロード後に deploy.sh に実行権限を付与しています。

```bash
wget https://raw.githubusercontent.com/aws-samples/generative-ai-use-cases/refs/heads/main/deploy.sh -O deploy.sh
chmod +x deploy.sh
```

## deploy.sh の実行

deploy.sh は以下のオプションをサポートしています：

```bash
-c, --cdk-context    ... Path to the cdk.json file
-p, --parameter-file ... Path to the parameter.ts file
-e, --env           ... Environment name (e.g., dev, prod)
-h, --help          ... Show this message
```

### デプロイ例

以下のコマンドで deploy.sh を実行します。 なお、--cdk-context オプションでカスタマイズした cdk.json へのパスを指定しています。(--parameter-file の場合は parameter.ts へのパス) 特に何もせず前述した手順で Upload files した場合はこのパスになります。cdk.json や parameter.ts が別のパスにある場合は、適宜引数の値を変更してください。

1. デフォルト設定でデプロイ：

```bash
./deploy.sh
```

2. カスタマイズした cdk.json を使用してデプロイ：

```bash
./deploy.sh --cdk-context ~/cdk.json
```

3. カスタマイズした parameter.ts を使用して無名環境をデプロイ：

```bash
./deploy.sh --parameter-file ~/parameter.ts
```

4. parameter.ts と環境を指定してデプロイ：

```bash
./deploy.sh --parameter-file ~/parameter.ts --env prod
```

デプロイ完了時に CloudFront の URL が表示されます。その URL をブラウザで開くことで GenU にアクセスできます。

### 設定の優先順位

1. parameter.ts と環境が指定され、かつ環境名(無名環境含む)が parameter.ts 内で定義されている場合、その環境の設定が最優先されます
2. cdk.json の設定が次に適用されます

なお、これらの手順を実行する場合も [Amazon Bedrock の Model access](https://console.aws.amazon.com/bedrock/home#/modelaccess) から利用するモデルの有効化が必要です。
使用する設定ファイル（parameter.ts または cdk.json）の modelRegion において modelIds と imageGenerationModelIds と videoGenerationModelIds と speechToSpeechModelIds で指定されたモデルが有効化されているかを確認してください。
