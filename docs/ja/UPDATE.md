# アップデート方法

GenU は頻繁にアップデートされています。
機能追加・改善に加え、セキュリティ文脈のアップデートが入ることもありますので、定期的に最新のリリースにアップデートして再デプロイすることをお勧めします。

リリースは Git のタグ (例: `v5.6.0`) として公開され、[Releases ページ](https://github.com/aws-samples/generative-ai-use-cases/releases) にリリースノートが掲載されます。
main ブランチにはまだリリースされていない変更も含まれるため、main ブランチではなくリリースをデプロイすることをお勧めします。

[AWS CloudShell を利用したデプロイ方法](./DEPLOY_ON_CLOUDSHELL.md) を利用している場合、`deploy.sh` はデフォルトで最新のリリースをデプロイするため、再度 `deploy.sh` を実行するとアップデートされます。(以下の手順は不要です。)

## 手動でアップデートする場合

ユーザー自身がアップデートする方法です。

### リリースノートを確認する

アップデートする前に、[Releases ページ](https://github.com/aws-samples/generative-ai-use-cases/releases) で、現在のバージョンから新しいバージョンまでのすべてのリリースノートを確認してください。
破壊的な変更 (リソースの置き換えや削除、設定項目の削除や名前の変更など) を含むリリースでは、リリースノートに影響と移行手順が記載されています。

現在のバージョンは以下のコマンドで確認できます。

```bash
git describe --tags
```

### 最新のリリースをマージする

すでにリポジトリを clone 済みで、初回デプロイが完了していることを想定しています。
[cdk.json](/packages/cdk/cdk.json) や [parameter.ts](/packages/cdk/parameter.ts) などのファイルを変更している場合は、先にご自身のブランチにコミットしてください。

以下のコマンドでリリースを取得し、最新のリリースをご自身のブランチにマージします。

```bash
git fetch --tags origin
git merge $(git describe --tags --abbrev=0 origin/main)
```

特定のリリースにアップデートする場合は、そのタグを指定します。

```bash
git merge v5.6.0
```

ご自身のコミットがない場合、マージは fast-forward になり、コードはリリースと同じ状態になります。
ご自身のコミットがある場合はマージコミットが作られ、コミットメッセージを編集するエディタが開きます。メッセージを変更しない場合は `--no-edit` を付けて実行できます。

```bash
git merge --no-edit v5.6.0
```

これまで main ブランチを pull してアップデートしていた場合、コードに最新のリリースより新しい変更がすでに含まれていることがあります。
その場合は上記のマージでは何も変わらず、次のリリースをマージした時点でリリースの内容に揃います。

### 別のリポジトリでカスタマイズしている場合

別のリポジトリ (fork など) でカスタマイズしている場合は、remote が別名で登録されている可能性があります。
remote は以下のコマンドで調べることが可能です。

```bash
git remote -v
```

以下の出力例の場合、aws-samples という Organization で管理されているリポジトリ (本家のリポジトリ) が aws という名前で登録されています。

```
origin  https://my-private-git-hosting-site.com/myawesomeorg/generative-ai-use-cases (fetch)
origin  https://my-private-git-hosting-site.com/myawesomeorg/generative-ai-use-cases (push)
aws     https://github.com/aws-samples/generative-ai-use-cases (fetch)
aws     https://github.com/aws-samples/generative-ai-use-cases (push)
```

この場合は、明示的に aws を指定します。

```bash
git fetch --tags aws
git merge $(git describe --tags --abbrev=0 aws/main)
```

`git remote -v` の結果に aws-samples で管理されているリポジトリが表示されない場合は、以下のコマンドで追加します。

```bash
git remote add aws https://github.com/aws-samples/generative-ai-use-cases
```

リリースのタグのマージは、その時点の main ブランチのマージと同じように動作します。カスタマイズはご自身のブランチに置いたまま、リリースごとにマージできます。
特定の変更だけが必要な場合は、main ブランチからそのコミットを cherry-pick することもできます。

### 取り込む前に変更を確認したい場合

マージする前に変更を確認するには、ご自身のコードとリリースを比較します。

```bash
git diff HEAD v5.6.0
```

### コンフリクトが発生した場合

マージ時にコンフリクトが発生した場合は、ご自身でカスタマイズしたコードと本家の変更が同じファイルに同時に入ったことを意味しています。
コンフリクトが発生したコードは手動で修正する必要があります。

特に [cdk.json](/packages/cdk/cdk.json) のコンフリクトには注意が必要です。
**手元で設定した項目が消えていないか、マージ後に必ず確認してください。**

`package-lock.json` のコンフリクトは手動で修正せず、本家の内容を採用してから再生成してください。

```bash
git checkout --theirs package-lock.json
npm install
git add package-lock.json
```

### 設定を cdk.json から parameter.ts に移す場合

[parameter.ts](/packages/cdk/parameter.ts) の `envs` に環境を定義すると、その環境では [cdk.json](/packages/cdk/cdk.json) のパラメータは使われず、parameter.ts に書いていない項目はデフォルト値になります。移す際は以下に注意してください。

- cdk.json でデフォルトから変更しているパラメータは、すべて移してください。漏れた項目はデフォルト値に戻ります。たとえば `ragKnowledgeBaseEnabled: true` が漏れると、Knowledge Base のスタックが削除されます。
- 環境名 (`env`) は変えないでください。環境名はスタック名に含まれるため、変えると別のスタックが作成されます。`-c env=` を付けずにデプロイしている場合は `''` の環境として定義します。
- parameter.ts には `dev`、`staging`、`prod` が空の状態で定義されています。これらの環境名でデプロイしている場合、cdk.json のパラメータはすでに使われていません。
- 移した後に `npm run cdk:diff` を実行し、移す前と同じ差分しか出ないことを確認してから再デプロイしてください。

### うまくいかない場合

| 表示されるメッセージ                                                      | 原因と対処                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Your local changes to the following files would be overwritten by merge` | コミットしていない変更があります。`git commit` でご自身のブランチにコミットするか、`git stash` で退避してから、もう一度マージしてください。                                                                                            |
| `CONFLICT (content): Merge conflict in ...`                               | [コンフリクトが発生した場合](#コンフリクトが発生した場合) を参照してください。マージを取り消してやり直す場合は `git merge --abort` を実行します。マージ前の状態に戻ります。                                                            |
| `merge: v5.6.0 - not something we can merge`                              | タグが取得されていないか、タグ名が間違っています。`git fetch --tags origin` (別名の remote の場合はその名前) を実行し、[Releases ページ](https://github.com/aws-samples/generative-ai-use-cases/releases) でタグ名を確認してください。 |
| `fatal: No names found, cannot describe anything.`                        | `git clone --depth 1` などで履歴を省略して clone したため、タグがありません。`git fetch --tags --unshallow origin` を実行してから、もう一度実行してください。                                                                          |
| `Already up to date.`                                                     | すでにそのリリース、またはそれより新しい main ブランチの内容が含まれています。エラーではありません。                                                                                                                                   |
| `fatal: destination path 'generative-ai-use-cases' already exists`        | clone 先に同じ名前のディレクトリがあります。既存のディレクトリでアップデートするか、別の名前で clone してください (`git clone <URL> <ディレクトリ名>`)。                                                                               |

コンフリクトの解消は、Kiro などの AI コーディングアシスタントに依頼することもできます。その場合も、[cdk.json](/packages/cdk/cdk.json) や [parameter.ts](/packages/cdk/parameter.ts) で設定した項目が残っているか、マージ後に必ず確認してください。

### main ブランチを利用する場合

まだリリースされていない変更が必要な場合は、リリースの代わりに main ブランチをマージできます。

```bash
git fetch origin
git merge origin/main
```

main ブランチには、まだリリースノートに記載されていない変更 (破壊的な変更を含む) が含まれることがあります。

### 再デプロイする

基本的には [README.md](/README.md) の手順に従いますが、Bootstrap は必要ありません。
パッケージがアップデートされている可能性があるため、`npm ci` コマンドは実行してください。

```bash
npm ci
npm run cdk:deploy
```

## アップデートを自動化する

AWS ではアップデートを自動化する方法もあります。
以下は AWS CodePipeline と連携することで、GitHub 上で 2 クリックするだけでアップデートする方法を紹介した記事です。  
[GenUを最速で更新！AWS CodePipelineで実現するワンクリック更新術](https://qiita.com/moritalous/items/9ade46091a60030415e0) by [@moritalous](https://x.com/moritalous)
