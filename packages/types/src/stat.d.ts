export interface TokenUsageStats {
  date: string;
  userId: string;
  // 基本的な集計データ
  totalExecutions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadInputTokens: number;
  totalCacheWriteInputTokens: number;

  // ユースケースごとの集計
  usecaseStats: {
    [usecase: string]: {
      executions: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheWriteInputTokens: number;
    };
  };

  // モデルごとの集計
  modelStats: {
    [modelId: string]: {
      executions: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheWriteInputTokens: number;
    };
  };
}

export interface TokenUsageFilter {
  yearMonth?: string;
  userId?: string;
  modelId?: string;
  usecase?: string;
  startDate?: string;
  endDate?: string;
}

export interface TokenUsageAggregation extends TokenUsageStats {
  id: string; // 'tokenUsage#YYYY-MM' or 'tokenUsageHourly#YYYY-MM-DD-HH'
  createdDate: string; // ISO date string with granularity
}

export interface GetTokenUsageEvent {
  queryStringParameters?: {
    yearMonth?: string;
    modelId?: string;
    usecase?: string;
    startDate?: string;
    endDate?: string;
  };
  requestContext: {
    authorizer: {
      claims: {
        'cognito:username': string;
        [key: string]: string | undefined;
      };
    };
  };
}
