# ブラウザ拡張機能のビルド手順

## 事前準備

ビルドするためには、Node.js のインストールが必須となります。インストールしていない方は、以下のいずれかの手順で準備してください。

- ローカル PC に Node.js をインストールする
  - [こちら](https://nodejs.org/en/download) から、「LTS」と記載されているバージョンをダウンロードして、インストールしてください。
- AWS 上の Cloud9 環境を利用する
  - [こちらの手順](./DEPLOY_ON_AWS.md#cloud9-環境の作成) を参考に、cloud9 環境を作成してください。

## ビルド

事前準備ができたら、以下の手順でビルドを行なってください。

以降の手順は、**必ず `generative-ai-use-cases` のルートフォルダで実行してください。`generative-ai-use-cases/browser-extension` ではありませんのでご注意ください。**

### Unix 系コマンドが使えるユーザー (Cloud9, Linux, MacOS 等)

以下のコマンドを実行することで、必要な環境変数を CloudFormation の Output から動的に取得し、適切に設定してビルドします。
なお、内部で `aws` コマンドと `jq` コマンドを利用しているので、未インストールの場合はインストールしてから実行してください。

```bash
npm run extension:ci
npm run extension:buildw
```

`browser-extension/dist/` にビルドの成果物が格納されます。

### その他のユーザー (Windows 等)

[CloudFormation](https://console.aws.amazon.com/cloudformation/home) の GenerativeAiUseCasesStack をクリックして出力タブを開くと、設定に必要な値を確認できます。

それらの値を環境変数に設定する必要がありますが、環境変数の設定は以下のいずれかの方法で行うことができます。

#### シェル変数を export する方法

以下のコマンドでシェル変数に値を設定し `export` とすることで、環境変数として利用できます。Windows 利用者でかつ PowerShell を利用している方は、コマンドが異なりますので[こちら](https://learn.microsoft.com/ja-jp/powershell/module/microsoft.powershell.core/about/about_environment_variables)を参照の上、設定を行なってください。

```bash
export VITE_APP_API_ENDPOINT=<API Endpoint>
export VITE_APP_REGION=<デプロイしたリージョン>
export VITE_APP_USER_POOL_ID=<Cognito User Pool ID>
export VITE_APP_USER_POOL_CLIENT_ID=<Cognito User Pool Client ID>
export VITE_APP_IDENTITY_POOL_ID=<Cognito Identity Pool ID>
export VITE_APP_PREDICT_STREAM_FUNCTION_ARN=<Function ARN>
```

具体例は以下です。

```bash
export VITE_APP_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/
export VITE_APP_REGION=ap-northeast-1
export VITE_APP_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
export VITE_APP_USER_POOL_CLIENT_ID=abcdefghijklmnopqrstuvwxyz
export VITE_APP_IDENTITY_POOL_ID=ap-northeast-1:xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxxx
export VITE_APP_PREDICT_STREAM_FUNCTION_ARN=arn:aws:lambda:ap-northeast-1:000000000000:function:FunctionName
```

#### `.env` ファイルを利用する方法

フロントエンドは Vite を利用してビルドを行っていますが、Vite は `.env` ファイルを利用して環境変数を設定できます（[参考](https://ja.vitejs.dev/guide/env-and-mode#env-files)）。`/browser-extension/.env` ファイルを作成し、上記の「シェル変数を export する方法」と同様の項目を設定してください。なお、`export` の記載は不要なので、ご注意ください。

```bash
VITE_APP_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/
VITE_APP_REGION=ap-northeast-1
### 以降省略 ###
```

#### ビルドの実行

環境変数の設定ができたら、以下のコマンドを実行します。

```bash
npm run extension:ci
npm run extension:build
```

`browser-extension/dist/` にビルドの成果物が格納されます。

## 配布方法

ビルド成果物の `browser-extension/dist/` フォルダを zip 等で圧縮してください。
圧縮ファイルを任意の方法で配布してください。
