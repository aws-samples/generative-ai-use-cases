# リリースノート

GenU の各リリースの概要です。リリースごとの変更の一覧は [Releases ページ](https://github.com/aws-samples/generative-ai-use-cases/releases) をご参照ください。

GenU はリリースタグからデプロイ・アップデートします ([アップデート方法](./UPDATE.md) 参照)。アップデートする前に、現在のバージョンから新しいバージョンまでのすべてのリリース、特に **アップデート前の確認事項** をご確認ください。

## 次のリリース (v5.6.0)

以下の変更は `main` ブランチにマージ済みで、次のリリース v5.6.0 に含まれる予定です。最新のリリースにはまだ含まれていません。

### 主な変更

- **トークン使用量とコストの管理者ページ**: 新しい Cognito グループ `SystemAdminGroup` のメンバーは、`/admin` で全ユーザーのトークン使用量と推定コストを確認し、ユーザーや期間で絞り込み、CSV でダウンロードできます。各ユーザーは設定画面の新しい「使用量」タブで自分の使用量とコストを確認できます。Bedrock の呼び出しには利用状況のタグ (`genu_user`、`genu_usecase`) が付き、モデル呼び出しログに記録されます。(#1827)
- **閉域モードの改善**: AgentCore Runtime が閉域 VPC 内で動作し、Interface VPC エンドポイントは利用する機能の分だけ作成されます。閉域モードで使えない設定は synth 時に警告されます。(#1814, #1761, #1723)
- **チャット**: モデルの選択を入力欄のツールバーに移動、会話履歴を日付ごとに表示、選択したモデルと推論の設定をリロード後も保持、Markdown の表をスプレッドシートに貼り付けられる形でコピー、チャットのモデルに今日の日付を伝えるようになりました。(#1788, #1781, #1787, #1782, #1786)
- **サイドバーと設定画面**: サイドバーをアイコン表示に折りたたんだり幅を変えたりでき、表示するユースケースを各ユーザーが選べるようになりました (お気に入り)。設定画面は「一般」「使用量」「アカウント」「システム」のタブに分かれ、サイドバーの使用量アイコンは「使用量」タブに移りました。`/stats` は引き続き使えます。(#1830, #1831)
- **モデルの提供終了の警告**: `cdk synth` / `cdk deploy` で、設定したモデルが Bedrock で提供終了済み、または提供終了日が決まっている場合に警告し、変更するパラメータを示します。デプロイは止まりません。(#1832)
- **Knowledge Base**: ベクトルストアとして S3 Vectors を選べるようになり、Knowledge Base チャットで Guardrails を使えるようになりました。(#1471, #1649)
- **音声**: 音声チャットで声と言語を選択、設定画面で音声認識の自動判別の対象言語を選択、speech-to-speech で Amazon Nova 2.5 Sonic を利用できるようになりました。(#1727, #1779, #1726)
- **Agent Builder**: エージェントの定義を JSON で共有できるようになりました。(#1689)
- **新しいモデル**: Claude Opus 5、Claude Fable 5、Claude Opus 5.5、Claude Sonnet 5.5、Claude Haiku 5.5、Claude Fable 5.1 / 5.2、OpenAI GPT-6 / GPT-6.1 / GPT-6.2 Sol / GPT-6.2 Astra / GPT-5.4 / GPT-5.5 / GPT-5.6、Moonshot AI Kimi K3 / K3.1 / K2.5、Grok 4.6 / 4.7、GLM 5、DeepSeek V3.2、MiniMax M2.5、NVIDIA Nemotron 3 Super 120B、Qwen3 Coder Next、Palmyra Vision 7B。(#1652, #1646, #1707, #1712, #1724, #1709, #1755, #1704, #1795, #1832)
- **アップデートの支援**: デプロイとアップデートの手順がリリースタグを使う形になり、`deploy.sh` はデフォルトで最新のリリースをデプロイします (`--ref` で別のリリースを指定できます)。カスタマイズしたブランチに新しいリリースをマージするための `genu-update` エージェントスキルを追加しました。(#1766, #1777)
- **カスタムドメイン**: `hostName` を指定せず、ゾーンの頂点 (Zone Apex) にカスタムドメインを設定できるようになりました。(#1834)

### アップデート前の確認事項

- **Knowledge Base の Web Crawler データソースの削除**: Bedrock で、カスタマー管理の Knowledge Base に新しく Web Crawler コネクタを作成できなくなりました。アップデートすると、既存の `web-crawler-data-source` と、そこから取り込んだドキュメントが削除されます。S3 データソースのドキュメントには影響しません。(#1747)
- **画像・動画生成のデフォルトモデル**: Nova Canvas と Nova Reel が提供終了 (EOL) になりました。画像生成のデフォルトは Stable Image Core (`us-west-2`) になり、動画生成はデフォルトで無効になりました。動画生成を続けて使う場合は、`videoGenerationModelIds` に `us-west-2` の `luma.ray-v2:0` を指定し、そのリージョンを bootstrap してください。モデルを自分で指定している環境には影響しません。(#1791)
- **テキストモデルのデフォルト**: `modelIds` を設定していない場合、`us.deepseek.r1-v1:0` (2027-03-30 に提供終了) が `openai.gpt-oss-120b-1:0` に置き換わります。`modelIds` を設定している環境には影響しません。(#1832)
- **デフォルト設定での提供終了の警告**: 画像生成のデフォルトモデル `stability.stable-image-core-v1:1` は Legacy (2027-05-09 に提供終了) のため、デフォルト設定ではデプロイ時に警告が 1 件表示されます。現時点で切り替え先となる Bedrock のテキストから画像を生成するモデルはありません。(#1832)
- **モデルの機能の修正**: Bedrock が受け付ける内容に合わせて、Mistral Large 3 と Ministral 3 で画像を添付できるようになり、Gemma 3 ではドキュメントを添付できなくなり、DeepSeek-R1 では推論の切り替えが表示されなくなりました。(#1832)
- **Knowledge Base の Advanced Parsing のデフォルトモデル**: これまでのデフォルト (Claude 3 Sonnet) が 2026-11-13 に提供終了になったため、`global.anthropic.claude-sonnet-4-6` に変わりました。(#1813)
- **閉域モード: VPC エンドポイント**: 有効にしていない機能の VPC エンドポイントは削除されます。インポートした VPC で他のワークロードが使っている場合は、デプロイ前に `closedNetworkAdditionalVpcEndpoints` に指定してください。
- **閉域モード: 検証用インスタンス**: 検証用インスタンスのタイプが `t3.large` に変わります。以前のタイプを使い続ける場合は `closedNetworkTestEnvironmentInstanceType: 'r6i.large'` を指定してください。
- **閉域モード: AgentCore**: AgentCore を有効にしている場合、ランタイムが閉域 VPC 内に移り、`agentCoreRegion` は `region` と同じである必要があります。`researchAgentEnabled` は閉域モードと併用できません。
- **閉域モード: API Gateway**: API Gateway のリソースポリシーの形が変わり、API のデプロイメントが作り直されます。許可していないエンドポイントからのリクエストは 401 ではなく 403 になります。(#1814, #1723)
- **新しい Cognito グループ**: `SystemAdminGroup` が作成されます。ユーザープールに同じ名前のグループがすでにある場合、アップデートが失敗します。(#1827)
- **議事録の文字起こし** は、UI の言語ではなく自動判別 (デフォルトは日本語と英語) で始まるようになりました。対象言語は設定画面で変更できます。(#1779)
- **`hostName` なしのカスタムドメイン**: `domainName` と `hostedZoneId` を設定し `hostName` を設定していない場合、アップデートするとゾーンの頂点 (`domainName` そのもの) の証明書と A レコードが作成されます。これまではカスタムドメインは設定されませんでした。不要な場合は `domainName` と `hostedZoneId` を削除してください。ゾーンの頂点に A レコードがすでにある場合、アップデートが失敗します。(#1834)

### 修正

- 長いメッセージを送ったときに会話が巻き戻らずに保存され、非常に長いテキストを貼り付けると添付ファイルになるようになりました。(#1757)
- Bedrock がリクエストを拒否した理由 (画像サイズの上限など) を表示するようになりました。(#1789, #1822)
- 同じ名前の添付ファイル、Shift_JIS / EUC-JP のドキュメント、空のテキスト、Bedrock が受け付けないファイル名の文字に対応しました。(#1756, #1805, #1679, #1765, #1801, #1677)
- Ministral 3 と Qwen3 235B が再び使えるようになりました (デフォルトの `maxTokens` がモデルの上限を超えていました)。システムプロンプトを受け付けないモデルに空のシステムプロンプトを送らなくなりました。(#1832)
- フローを設定していない場合、`/flow-chat` は「見つかりません」のページになります。(#1829)
- ブラウザのページ翻訳を使ったあとも正しく動くようになりました。(#1828, #1833)
- S3 Vectors の Knowledge Base で、`{{retrieveKnowledgeBase}}` を使うユースケースが動くようになりました。(#1837)
- エージェントギャラリーの同期、IP 制限を設定していない場合の S3 の権限、長い会話の読み込みを修正しました。(#1826)
- 大きな画像は添付時に長辺 2,576 px に縮小し、画像の縦横で Bedrock に拒否されないようになりました。画像を 20 枚まで受け付けないモデルでは添付できる枚数を制限します (Llama 3.2 Vision は 1 枚、Llama 4 は 8 枚)。(#1835, #1836)

## v5.5.0 (2026-07-19)

### 主な変更

- **新しいモデル**: Claude Sonnet 5、Claude Opus 4.8、Claude Opus 4.7、Claude Opus 4.6 / Sonnet 4.6。
- **AgentCore**: AgentCore Runtime の VPC 設定と、AgentCore の一覧画面。
- **リサーチのユースケース**。
- **Knowledge Base**: Web Crawler データソース、引用の改善、システムプロンプトのカスタマイズ。
- **議事録**: カスタムプロンプト、生成した議事録のダウンロード、録音中の画面スリープ防止。
- **Markdown**: コードブロックでの ECharts のグラフと SVG のプレビュー。
- **ブラウザ拡張機能**: モデルの切り替え。
- **セキュリティ**: 自動デプロイのワークフローでのスクリプトインジェクション対策、CSP から `unsafe-eval` を削除、依存パッケージの CVE への対応。
- **内部**: API の Lambda 関数を 1 つの Express アプリケーションにまとめ、閉域モードでは Cognito に VPC エンドポイント経由で接続するようになりました。

[変更の一覧](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.5.0)

## v5.4.0 (2026-01-13)

### 主な変更

- **Agent Builder**: コードを書かずにエージェントを作成でき、システムプロンプトも自動生成できます。
- チャットでの **Mermaid の図と数式の表示**。
- **ブランディング**: ロゴとタイトルのカスタマイズ。
- **会話履歴**: 一括削除。
- **議事録**: 録音中にページを離れようとすると警告。
- **新しいモデル**: Claude Opus 4.5、Nemotron 3 Nano 30B ほか 17 モデル、デフォルトモデルの設定。
- **AgentCore**: MCP の読み込みの高速化と AgentCore Gateway への対応。
- リソースを削除する `destroy.sh` と `cdk:diff` のショートカット。

[変更の一覧](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.4.0)

## v5.3.0 (2025-10-27)

### 主な変更

- コスト管理用のタグのキーをカスタマイズ。
- Claude Haiku 4.5。
- 閉域モードでの AgentCore のユースケース。

[変更の一覧](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.3.0)

## v5.2.0 (2025-10-15)

### 主な変更

- Claude Sonnet 4.5 (Extended Thinking とプロンプトキャッシュに対応)。
- エージェントのループの最大回数を設定。
- 議事録のリアルタイム翻訳の改善。
- プライベートネットワークのオプションを使った SageMaker Code Editor からのデプロイ。
- 提供終了したモデルの削除。

[変更の一覧](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.2.0)

## v5.1.0 - v5.1.2 (2025-08-29 - 2025-09-11)

### 主な変更

- チャットでの推論の切り替えと、AgentCore の UI の改善。
- グローバルのクロスリージョン推論。
- 閉域モードと、エージェントのユースケースでアップロードしたファイルに関する修正。

### アップデート前の確認事項

- **SageMaker エンドポイント** は TGI の Messages API で呼び出すようになり、アプリケーション側のプロンプトテンプレートは削除されました。TGI 1.4.0 以降を使い、モデルの `tokenizer_config.json` に `chat_template` があることを確認してください (v5.1.0)。

[v5.1.0](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.0) / [v5.1.1](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.1) / [v5.1.2](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.2)

## v5.0.0 - v5.0.1 (2025-08-26)

### 主な変更

- **AgentCore**: Amazon Bedrock AgentCore 上のエージェント。
- **閉域モード**: VPC 内からのみ GenU にアクセスする構成。
- **音声チャット** の一般提供。
- OpenAI GPT OSS 20B / 120B。
- コスト管理用のタグ。

### アップデート前の確認事項

- **MCP チャット** は非推奨になり、今後のメジャーバージョンで削除されます。

[v5.0.0](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.0.0) / [v5.0.1](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.0.1)
