# (DEPRECATED) AWS 上で完結するデプロイ方法 (手元に環境を用意することが難しい場合)

> [!Caution]
> この手順は AWS Cloud9 が新規のお客様向けアクセスを閉じたことを受け、非推奨手順となりました。
> AWS 上で完結するデプロイ方法については [CloudShell を利用したデプロイ方法](./DEPLOY_ON_CLOUDSHELL.md) をご参照ください。
> また、AWS Cloud9 からの移行については [こちら](https://aws.amazon.com/jp/blogs/news/how-to-migrate-from-aws-cloud9-to-aws-ide-toolkits-or-aws-cloudshell/) のブログをご参照ください。

AWS CloudShell と AWS Cloud9 を利用することで、手元の環境に依存しないデプロイが可能です。(デプロイが AWS 上で完結します。)

## Cloud9 環境の作成

[cloud9-setup-for-prototyping](https://github.com/aws-samples/cloud9-setup-for-prototyping) を利用します。cloud9-setup-for-prototyping で作成した環境は、デフォルトで作成される Cloud9 環境とは違い、メモリやストレージ不足、権限不足などのハマりどころに対処しています。[AWS CloudShell](https://console.aws.amazon.com/cloudshell/home) を開き、[cloud9-setup-for-prototyping の README.md](https://github.com/aws-samples/cloud9-setup-for-prototyping) の手順に従って Cloud9 環境を作成します。以下に、実行コマンドだけを端的に示します。詳細は README.md でご確認ください。

```bash
git clone https://github.com/aws-samples/cloud9-setup-for-prototyping
cd cloud9-setup-for-prototyping
./bin/bootstrap
```

作成が完了すると、[AWS Cloud9](https://console.aws.amazon.com/cloud9control/home) に cloud9-for-prototyping という環境が作成されているので、Open をクリックし IDE を開きます。
以下の全ての手順は、作成した IDE で行います。

## generative-ai-use-cases のデプロイ

IDE 下部の Terminal で以下のコマンドを実行します。generative-ai-use-cases を git clone し、作業ディレクトリに移動しています。

```bash
git clone https://github.com/aws-samples/generative-ai-use-cases
cd generative-ai-use-cases/
```

その後の手順は [generative-ai-use-cases の README.md](/README.md#デプロイ) の手順に従ってください。以下に、実行コマンドだけを端的に示します。

```bash
npm ci
npx -w packages/cdk cdk bootstrap # 必要な場合のみ CDK Bootstrap (重複して実行されても問題はない)
npm run cdk:deploy
```

## デプロイオプションの設定変更

`cloud9-for-prototyping/generative-ai-use-cases/packages/cdk/cdk.json` を開き、context 内の項目を変更します。設定可能な内容については[こちら](./DEPLOY_OPTION.md)をご参照ください。

cdk.json の内容を変更したら、ファイルを保存して、`npm run cdk:deploy` を実行します。デプロイすることで設定変更が反映されます。

## フロントエンドの開発

Cloud9 の Preview 機能を使うためには、localhost の 8080 ~ 8082 ポートで Listen する必要があります。([参考](https://docs.aws.amazon.com/ja_jp/cloud9/latest/user-guide/app-preview.html)) generative-ai-use-cases のフロントエンド開発で利用している [Vite](https://ja.vitejs.dev/) はデフォルトで 5173 ポートを使うため、これを変更します。

`cloud9-for-prototyping/generative-ai-use-cases/packages/web/package.json` を開き、scripts の中の dev コマンドを `vite` から `vite --port 8080` に変更します。変更後の package.json の一部は以下のようになります。(なお、vite.config.ts でポートを設定することも可能ですが、ここでは案内しません。)

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 8080",
  ... 省略
```

変更後にファイルを保存してください。続いて、後続のコマンドの内部で利用する `jq` をインストールします。

```bash
sudo yum -y install jq
```

その後は[こちら](./DEVELOPMENT.md) の手順に従います。以下のコマンドを実行してください。

```bash
npm run web:devw
```

実行後、IDE 上部の Preview をクリックし Preview Running Application をクリックします。これで IDE 内にブラウザが表示されます。フロントエンドのコードを変更すると、リアルタイムで画面に変更が適用されます。IDE 内のブラウザの右上に「別画面で開く」アイコンのボタンがあります。そちらをクリックすることで、ブラウザの別タブで Preview を開くことができます。別タブで開いたあとは、IDE 内のブラウザは閉じてしまって構いません。
