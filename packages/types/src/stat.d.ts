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
