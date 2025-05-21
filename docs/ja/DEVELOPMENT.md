## ローカル環境構築手順

開発者用にローカル環境を構築する手順を説明します。なお、ローカル環境を構築する場合も、[AWS へのデプロイ](/README.md#デプロイ)は完了している必要があります。

### (推奨) Unix 系コマンドが使えるユーザー (Cloud9, Linux, MacOS, Windows WSL/Bash/Git Bash 等)

以下のコマンドを実行することで、必要な環境変数を CloudFormation の Output から動的に取得し、サーバーを起動します。
なお、内部で `aws` コマンドと `jq` コマンドを利用しているので、未インストールの場合はインストールしてから実行してください。

```bash
npm run web:devw
```

> [!TIP]
> AWSへの認証には[デフォルトのプロファイル](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/cli-configure-files.html#cli-configure-files-using-profiles)が利用されます。
> 別のプロファイルやアクセスキーを認証に使いたい場合はあらかじめ環境変数をセットしておくか、[setup-env.sh](/setup-env.sh)に追加しておくことができます。
>
> ```bash
> export AWS_PROFILE=''
> export AWS_DEFAULT_REGION=''
> ```

> [!TIP]
> バックエンドの環境を切り替えて利用したい際は、cdk.json の context.env を変更するか、`npm run web:devw --env=dev2` のようにコマンドライン引数で指定してください。

### Windows ユーザー

Windows ユーザー用に開発環境を立ち上げる PowerShell スクリプト `web_devw_win.ps1` を用意しており、`web:devww` から起動できます (`w` が一つ多い)。`setup-env.sh` を PowerShell に置き換えたのに近いスクリプトで、`aws` コマンドは必要ですが `jq` は必要ありません。

```bash
npm run web:devww
```

正常に実行されれば http://localhost:5173 で起動しますので、ブラウザからアクセスしてみてください。AWS のプロファイルは `-profile` で指定できますが、Windows 上で引数を指定する際は `npm run web:devww '--' -profile dev` といったように `--` をシングルクウォートで囲ってください。これは `npm` の既知の不具合になります ([Issue 3136](https://github.com/npm/cli/issues/3136#issuecomment-2632044780))。

### その他のユーザー

手動で環境変数を設定することも可能です。ただし、数が多いため、基本的には前述した `npm run web:devw` の方法を推奨します。
手動で設定する場合は `.env` ファイルを `/packages/web/.env` に作成し、以下のように環境変数を設定してください。

```bash
VITE_APP_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/
VITE_APP_REGION=ap-northeast-1
### 以降省略 ###
```

必要な環境変数とその値は [`setup-env.sh`](/setup-env.sh) と CloudFormation の Output の値 (マネージメントコンソール) を照合して設定してください。
環境変数の設定ができたら、以下のコマンドを実行します。

```bash
npm run web:dev
```

正常に実行されれば http://localhost:5173 で起動しますので、ブラウザからアクセスしてみてください。

## Pull Request を出す場合

バグ修正や機能改善などの Pull Request は歓迎しております :tada:

`git commit`が実行された際、`npm run lint`が実行されます。しかし、失敗すると、以下のようなエラーが発生します。

```bash
⚠ Running tasks for staged files...
  ❯ package.json — 1 file
    ❯ **/* — 1 file
      ✖ sh -c 'npm run lint' [FAILED]
      ...
```

もし、このエラーを無視してDraft PR を作成したい場合は、以下のように `--no-verify` オプションを付けてください。

```bash
git commit -m "xxx" --no-verify
```

もしCDK に変更があれば以下のコマンドでスナップショットの確認を行いスナップショットを更新してください。

```bash
# 差分を確認
npm run cdk:test

# テストを更新
npm run cdk:test:update-snapshot
```
