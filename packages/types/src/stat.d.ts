export interface TokenUsageStats {
  date: string;
  userId: string;
  // Execution count statistics
  executions: {
    overall: number;
    [key: string]: number; // model#{modelId} or usecase#{usecase}
  };
  // Input token statistics
  inputTokens: {
    overall: number;
    [key: string]: number;
  };
  // Output token statistics
  outputTokens: {
    overall: number;
    [key: string]: number;
  };
  // Cache read input token statistics
  cacheReadInputTokens: {
    overall: number;
    [key: string]: number;
  };
  // Cache write input token statistics
  cacheWriteInputTokens: {
    overall: number;
    [key: string]: number;
  };
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

/** One user's totals over the requested period (the `overall` values). */
export interface UserTokenUsageTotals {
  userId: string;
  /** From Cognito; missing when the user no longer exists or was not looked up. */
  email?: string;
  executions: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
}

/** `GET /admin/token-usage`: every user's usage over a date range. */
export interface GetAdminTokenUsageResponse {
  /** Per day, all users added together (`userId` is `*`). */
  daily: TokenUsageStats[];
  /** Per user, sorted by input + output tokens, largest first. */
  users: UserTokenUsageTotals[];
}
