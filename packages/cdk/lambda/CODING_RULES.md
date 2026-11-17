# コーディング規約 - バックエンドAPI

## Lambda関数 (TypeScript)

### 1. アーキテクチャ概要

**概要**: API Gateway 配下の API は Express Monolith（Lambda Web Adapter）に集約し、クライアントから直接 invoke される Lambda は個別関数として定義する

#### Lambda 構成

- **Express Monolith (`api/`)**: API Gateway 経由の全 API を1つの Lambda で処理。Lambda Web Adapter (LWA) を使用して Express アプリを Lambda 上で実行する
- **個別 Lambda**: クライアント（Cognito Identity Pool）から直接 invoke される関数（`predictStream.ts`, `invokeFlow.ts`, `copyVideoJob.ts`, `optimizePrompt.ts` 等）

### 2. ファイル構成

**概要**: Express Monolith のルーティングは `api/routes/` で管理し、ビジネスロジックは既存のハンドラーファイルに実装する

```
packages/cdk/lambda/
├── api/                             # Express Monolith（API Gateway 経由の API）
│   ├── index.ts                     # Express アプリのエントリーポイント
│   ├── middleware.ts                # CORS・request context・エラーハンドラー
│   ├── run.sh                       # LWA 起動スクリプト
│   └── routes/                      # ルート定義
│       ├── chats.ts                 # /chats ルート
│       ├── predict.ts               # /predict ルート
│       └── ...                      # 機能別ルートファイル
├── *.ts                             # ビジネスロジック（API単位でファイル作成）
│                                    # 例: createChat.ts, deleteChat.ts, listMessages.ts
├── predictStream.ts                 # 直接 invoke 用 Lambda
├── invokeFlow.ts                    # 直接 invoke 用 Lambda
├── repository.ts                    # データアクセス層（メイン）
├── repositoryVideoJob.ts            # 特定機能用データアクセス層
├── useCaseBuilder/                  # 機能別ディレクトリ
│   ├── *.ts                         # 機能内のAPI
│   └── useCaseBuilderRepository.ts  # 機能専用データアクセス層
└── utils/                           # 共通ユーティリティ
    ├── bedrockApi.ts               # Bedrock API呼び出し
    ├── bedrockKbApi.ts             # Bedrock Knowledge Base API
    ├── bedrockAgentApi.ts          # Bedrock Agent API
    ├── bedrockClient.ts            # Bedrockクライアント初期化
    ├── sagemakerApi.ts             # SageMaker API呼び出し
    ├── models.ts                   # モデル定義・設定
    ├── auth.ts                     # 認証処理
    └── api.ts                      # API共通処理
```

#### ファイル分割ルール

- **ビジネスロジック**: API単位で `lambda/` 直下にファイル作成（ファイル名でAPIの役割を表現）
- **ルート定義**: `api/routes/` 配下に機能別ルートファイルを作成
- **大きな機能単位**: メイン機能と独立して開発可能な場合はフォルダ分離
  - 独立性の基準: 独自に開発を進められ、独立して起動可能なレベル
  - 例: useCaseBuilder/ - Use Case Builder機能一式
  - utils等の共通機能は引き続き共有する
- **データアクセス層**: repository.tsで一元管理、機能別に必要な場合のみ分離
- **共通処理**: utils/配下に外部サービス別に分割

#### Express ルートとハンドラー

各ハンドラーは Express ネイティブ（`(request, response) => Promise<void>`）で、ルートは `utils/http.ts` の `route()` で登録する。`route()` は reject された Promise を 500 に変換する（Express 4 はハンドラーを await しないため必須）。

```typescript
import { handler as createChatHandler } from '../../createChat';
import { route } from '../../utils/http';

router.post('/', route(createChatHandler));
```

#### フォルダ分離の判断基準

```typescript
// ✅ 良い例 - 独立性が高い機能はフォルダ分離
useCaseBuilder/
├── createUseCase.ts
├── listUseCases.ts
└── useCaseBuilderRepository.ts

// ✅ 良い例 - 関連するAPIでも独立性が低い場合は同一階層
createChat.ts
deleteChat.ts
listChats.ts

// ❌ 悪い例 - 過度な分離
chat/
├── create.ts    # 単純なCRUD操作のみ
├── delete.ts
└── list.ts
```

### 3. Lambda関数の基本構造

**概要**: Express Monolith 内のルートハンドラーと、直接 invoke 用の個別 Lambda ハンドラーの2パターンがある

#### Express ルートハンドラー（API Gateway 経由）

ユーザーは `utils/http.ts` の `requireUserName` / `requireUserSub` で取得する（`api/middleware.ts` が Lambda Web Adapter から受け取った request context だけを見る）。claims がなければ throw し、`route()` が 500 を返す（request context がない要求は middleware が先に 401 で返す）。レスポンスは `sendJson`（値を `JSON.stringify` する）か `sendText`（文字列をそのまま返す。空なら本文なし）で返す。

```typescript
// ✅ 良い例
import { Request, Response } from 'express';
import { requireUserName, sendJson } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId = requireUserName(request);
  const result = await businessLogic(
    userId,
    request.params.chatId,
    request.body
  );
  return sendJson(response, 200, result);
};
```

- パスパラメーターは `request.params`、クエリは `queryParams(request)`、ボディは `request.body`（パース済み）
- テストは `test/lambda/api/testApp.ts` の `invokeHandler` / `callApi` で、本番と同じミドルウェアを通して呼ぶ

#### 直接 invoke 用 Lambda ハンドラー

```typescript
// ✅ 良い例 - 標準的なハンドラー構造
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId: string =
      event.requestContext.authorizer!.claims['cognito:username'];
    const result = await businessLogic(userId, event.body);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};

// ❌ 悪い例 - 型定義なし、エラーハンドリングなし
export const handler = async (event: any) => {
  const result = await someFunction();
  return result;
};
```

### 4. 環境変数の使用

**概要**: 環境変数は型安全に取得し、必須項目は起動時にチェックする

```typescript
// ✅ 良い例 - 型安全な環境変数取得
const TABLE_NAME: string = process.env.TABLE_NAME!;
const MODEL_REGION: string = process.env.MODEL_REGION!;

// ✅ 良い例 - オプショナルな環境変数
const KNOWLEDGE_BASE_ID: string | undefined = process.env.KNOWLEDGE_BASE_ID;

// ❌ 悪い例 - 型指定なし、nullチェックなし
const tableName = process.env.TABLE_NAME;
```

### 5. データアクセス層

**概要**: repository.tsでデータアクセスを一元管理し、ビジネスロジックと分離する。DynamoDBの効率的なクエリパターンを使用する

#### DynamoDB操作のベストプラクティス

```typescript
// ✅ 良い例 - QueryCommandを使用（効率的）
export const getChatsByUserId = async (userId: string): Promise<Chat[]> => {
  const result = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'id = :userId',
      ExpressionAttributeValues: {
        ':userId': `user#${userId}`,
      },
    })
  );
  return result.Items as Chat[];
};

// ✅ 良い例 - GSI（Global Secondary Index）を使用
export const getChatsByUseCase = async (usecase: string): Promise<Chat[]> => {
  const result = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'UseCaseIndex', // GSIを使用
      KeyConditionExpression: 'usecase = :usecase',
      ExpressionAttributeValues: {
        ':usecase': usecase,
      },
    })
  );
  return result.Items as Chat[];
};

// ✅ 良い例 - BatchGetCommandで複数アイテムを効率的に取得
export const getMultipleChats = async (chatIds: string[]): Promise<Chat[]> => {
  const result = await dynamoDbDocument.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: chatIds.map((id) => ({ id })),
        },
      },
    })
  );
  return (result.Responses?.[TABLE_NAME] as Chat[]) || [];
};

// ❌ 悪い例 - ScanCommandを使用（全件走査）
export const getAllChats = async (): Promise<Chat[]> => {
  const result = await dynamoDbDocument.send(
    new ScanCommand({
      TableName: TABLE_NAME, // 全件走査は非効率
    })
  );
  return result.Items as Chat[];
};

// ❌ 悪い例 - N+1クエリ問題
export const getChatsWithMessages = async (userId: string) => {
  const chats = await getChatsByUserId(userId);

  // 各チャットに対して個別にクエリ実行（N+1問題）
  for (const chat of chats) {
    chat.messages = await getMessagesByChatId(chat.chatId);
  }

  return chats;
};
```

#### データアクセスのルール

- **禁止**: ScanCommand（全件走査）の使用
- **必須**: QueryCommandまたはGetItemCommandを使用
- **推奨**: GSI（Global Secondary Index）の活用
- **N+1クエリ**: 原則禁止（ただし、データ量が少ない場合は許可）
- **バッチ処理**: BatchGetCommand、BatchWriteCommandを活用
- **分離**: repository.tsでデータアクセスロジックを集約

### 6. 外部API呼び出し

**概要**: utils配下にAPI別のファイルを作成し、エラーハンドリングを適切に行う

#### Bedrock API呼び出し

```typescript
// ✅ 良い例 - utils/bedrockApi.tsで外部API呼び出しを集約
import {
  InvokeModelCommand,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { initBedrockRuntimeClient } from './bedrockClient';

export const invokeModel = async (params: InvokeParams): Promise<Response> => {
  try {
    const client = initBedrockRuntimeClient();
    const command = new InvokeModelCommand(params);
    const response = await client.send(command);
    return response;
  } catch (error) {
    if (error instanceof ThrottlingException) {
      // 適切なエラーハンドリング
      throw new Error('Rate limit exceeded');
    }
    throw error;
  }
};

// ❌ 悪い例 - Lambda関数内で直接API呼び出し
export const handler = async (event: APIGatewayProxyEvent) => {
  const client = new BedrockRuntimeClient({});
  // 直接API呼び出し
};
```

### 7. エラーハンドリング

**概要**: 想定外の例外はハンドラーで catch しない。ルーターが `route()` で包むので、`route()` がログを出して `500 { message: 'Internal Server Error' }` を返す。ハンドラーは、利用者に別の答えを返す失敗だけを扱う

```typescript
// ✅ 良い例 - 想定外の失敗は route() に任せる
router.get('/:chatId', route(findChatByIdHandler));

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const chat = await findChatById(
    requireUserName(request),
    request.params.chatId
  );
  if (chat === null) {
    // 想定内の失敗は、ステータスを選んでハンドラーで返す
    return sendJson(response, 404, { message: 'Not found' });
  }
  return sendJson(response, 200, { chat });
};

// ✅ 良い例 - エラー内容を利用者に返す必要があるときだけ catch する
try {
  return sendText(response, 200, await generateImage(request.body));
} catch (error) {
  console.log(error);
  return sendJson(response, 500, { message: (error as Error).message });
}

// ❌ 悪い例 - 想定外の失敗を 200 で返す
catch (error) {
  return sendJson(response, 200, { error: 'Failed' });
}
```

#### HTTPステータスコード

**概要**: 一般的なHTTPステータスコードを使用する

```typescript
// ✅ 良い例 - 一般的なステータスコード
200: // 成功
400: // バリデーションエラー
401: // 認証エラー（API Gateway と api/middleware.ts が返す。ハンドラーでは返さない）
403: // 認可エラー
404: // リソースが見つからない
500: // サーバー内部エラー

// ❌ 悪い例 - 独自ステータスコード
299: // 独自の成功コード
450: // 独自のエラーコード
```

### 8. 型定義

**概要**: バックエンドとフロントエンドで共有する型定義は`packages/types/src`内に定義し、APIスキーマは`protocol.d.ts`で管理する

#### 型定義の配置

- **共有型定義**: `packages/types/src/` - バックエンドとフロントエンド間で共有する全ての型
- **APIスキーマ**: `packages/types/src/protocol.d.ts` - API Request/Response型の専用ファイル
- **エンティティ型**: `packages/types/src/chat.d.ts`、`message.d.ts`等 - ドメインオブジェクトの型定義
- **ファイル拡張子**: `.d.ts`を使用（型定義専用ファイル）

#### APIスキーマ定義（protocol.d.ts）

- **Request型**: APIエンドポイントへの入力パラメータを定義
- **Response型**: APIエンドポイントからの戻り値を定義
- **命名規則**: `{機能名}Request`、`{機能名}Response`の形式
- **用途**: フロントエンドとバックエンドで型安全性を保証

#### 共通型の使用

- **基本エンティティ**: Chat、Message、SystemContext等の既存型を使用
- **AWS SDK型**: DynamoDB、Bedrock等のAWS SDK提供型を活用
- **独自型**: 既存型で表現できない場合のみ最小限で定義

#### 型定義のルール

- **共有型**: `packages/types/src`内で定義し、`generative-ai-use-cases`パッケージ経由でimport
- **APIスキーマ**: `protocol.d.ts`でRequest/Response型を定義
- **独自型**: 必要最小限に留め、既存型との重複を避ける
- **禁止**: any型の使用、型なしでの実装

### 9. ログ出力

**概要**: console.logを使用し、適切なログレベルで出力する

```typescript
// ✅ 良い例 - 適切なログ出力
console.log('Processing request for user:', userId);
console.error('Error occurred:', error);

// ✅ 良い例 - 構造化ログ
console.log(
  JSON.stringify({
    level: 'info',
    message: 'Chat created',
    userId,
    chatId,
    timestamp: new Date().toISOString(),
  })
);

// ❌ 悪い例 - 機密情報のログ出力
console.log('User credentials:', event.headers.authorization);
```

### 10. 非同期処理

**概要**: async/awaitを使用し、Promise.allで並列処理を活用する

```typescript
// ✅ 良い例 - 並列処理の活用
const [userData, chatHistory] = await Promise.all([
  getUserData(userId),
  getChatHistory(chatId),
]);

// ✅ 良い例 - 適切なエラーハンドリング付き非同期処理
try {
  const result = await asyncOperation();
  return result;
} catch (error) {
  console.error('Async operation failed:', error);
  throw error;
}

// ❌ 悪い例 - 逐次処理
const userData = await getUserData(userId);
const chatHistory = await getChatHistory(chatId);
```

### 11. 認可処理

**概要**: userIdを取得してデータアクセスを制御し、ユーザーが自分のデータのみにアクセスできるようにする

```typescript
// ✅ 良い例 - 適切な認可処理
export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  // Cognitoからユーザー情報を取得
  const userId = requireUserName(request);

  // userIdを使ってデータアクセスを制御
  const userChats = await getChatsByUserId(userId);
  return sendJson(response, 200, { chats: userChats });
};

// ✅ 良い例 - repository層での認可制御
export const getChatsByUserId = async (userId: string): Promise<Chat[]> => {
  const result = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'id = :userId',
      ExpressionAttributeValues: {
        ':userId': `user#${userId}`, // userIdでフィルタリング
      },
    })
  );
  return result.Items as Chat[];
};

// ❌ 悪い例 - 認可制御なし
export const handler = async (request: Request, response: Response) => {
  // userIdを取得せずに全データを返す
  const allChats = await getAllChats(); // 他ユーザーのデータも含む
  return sendJson(response, 200, { chats: allChats });
};

// ❌ 悪い例 - クライアントから送信されたuserIdを信頼
export const handler = async (request: Request, response: Response) => {
  const userId = request.body.userId; // クライアントから送信された値を使用（危険）

  const userChats = await getChatsByUserId(userId);
  // 他ユーザーのデータにアクセス可能
};
```

#### 認可処理のベストプラクティス

- **必須**: Cognitoの認証情報からuserIdを取得
- **データアクセス**: 全てのクエリでuserIdによるフィルタリングを実装
- **禁止**: クライアントから送信されたuserIdの使用
- **原則**: ユーザーは自分のデータのみにアクセス可能

### 12. パフォーマンス

**概要**: 不要な処理を避け、効率的な実装を心がける

```typescript
// ✅ 良い例 - 早期リターン
if (!userId) {
  return errorResponse(400, 'User ID is required');
}

// ✅ 良い例 - 必要な場合のみ重い処理を実行
if (shouldProcessLargeData) {
  const result = await heavyProcessing();
}

// ❌ 悪い例 - 不要な処理
const allData = await getAllData(); // 大量データ取得
const filteredData = allData.filter((item) => item.userId === userId);
```
