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

上記のデフォルトのファイルは main ブランチのものです。main ブランチにまだリリースされていない変更がある場合は、デプロイするリリースのファイルをダウンロードしてください。[Releases ページ](https://github.com/aws-samples/generative-ai-use-cases/releases) でタグを選択してからファイルを開くと、そのリリースのファイルを取得できます。

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
-r, --ref           ... Git tag or branch to deploy (default: the latest release)
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

5. 特定のリリースやブランチを指定してデプロイ (指定しない場合、`deploy.sh` は最新のリリースをデプロイします)：

```bash
./deploy.sh --ref v5.6.0
./deploy.sh --ref main
```

デプロイ完了時に CloudFront の URL が表示されます。その URL をブラウザで開くことで GenU にアクセスできます。

### 設定の優先順位

1. parameter.ts と環境が指定され、かつ環境名(無名環境含む)が parameter.ts 内で定義されている場合、その環境の設定が最優先されます
2. cdk.json の設定が次に適用されます

なお、Amazon Bedrock の Model access ページは廃止されたため、同ページでモデルを有効化する必要はありません。サーバーレスの基盤モデルは、AWS アカウントで初めて呼び出したときに自動的に有効化されます。Anthropic のモデルは、初回のみ利用目的の入力が必要になる場合があります。設定ファイル (parameter.ts または cdk.json) の modelRegion に指定した modelIds、imageGenerationModelIds、videoGenerationModelIds、speechToSpeechModelIds のモデルが、ご利用のアカウントで利用可能であることをご確認ください。
