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

> [!IMPORTANT]
> デプロイされた API はデプロイされたフロントエンドのオリジンからのリクエストのみを受け付けるため、`allowedDevOrigins` にローカルのオリジンを追加してデプロイしてください。設定しない場合、ブラウザのコンソールに `No 'Access-Control-Allow-Origin' header is present on the requested resource` という CORS エラーが表示され、会話履歴の保存などの API 呼び出しが失敗します。
>
> ```typescript
> // packages/cdk/parameter.ts
> const envs: Record<string, Partial<StackInput>> = {
>   dev: {
>     allowedDevOrigins: ['http://localhost:5173'],
>   },
> };
> ```
>
> スキーム + ホスト（+ ポート）の形式で指定してください（末尾のスラッシュやパスを含めると一致しません）。本番環境では設定しないことを推奨します。

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

## Lint とコードスタイル

このプロジェクトでは、コード品質と一貫したスタイルを保つために **ESLint** と **Prettier** を使用しています。

### ESLint の設定

- **設定ファイルの場所**: ESLint の設定は各パッケージディレクトリに配置されています:
  - `packages/web/.eslintrc.cjs` (フロントエンド)
  - `packages/cdk/.eslintrc.cjs` (CDK/インフラ)
  - `browser-extension/.eslintrc.json` (ブラウザ拡張)
- **ベースルール**: 以下の一般的な設定を拡張しています:
  - `eslint:recommended`
  - `plugin:@typescript-eslint/recommended`
  - `plugin:react-hooks/recommended` (React コード用)
  - `plugin:tailwindcss/recommended` (フロントエンド用)
- **主要なルール**:
  - 未使用のインポート/変数の検出
  - React Hooks のルール (例: `exhaustive-deps`)
  - 日本語文字列の検出 (i18n 対応)
  - YAML のフォーマットとキーのソート

### ESLint の実行

コミット前に以下を実行してください:

```bash
npm run lint
```

自動修正を行う場合:

```bash
npm run web:lint:fix  # フロントエンドコード用
```

### Pre-commit フック

このリポジトリでは [Husky](https://typicode.github.io/husky) を使用して Git フックを管理しています。`git commit` 時に `lint-staged` 経由で自動的に lint が実行されます。

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

### レビュー基準

- Lint ルールは**レビュー基準**として使用されます。
- 不要なレビューサイクルを避けるため、PR を開く前にコードが lint を通過することを確認してください。
- 一貫したスタイルは可読性を向上させ、コードレビューでのやり取りを減らします。

もしCDK に変更があれば以下のコマンドでスナップショットの確認を行いスナップショットを更新してください。

```bash
# 差分を確認
npm run cdk:test

# テストを更新
npm run cdk:test:update-snapshot
```
