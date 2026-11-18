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
  /**
   * Estimated cost (USD, list prices) of the priced models: `overall` and
   * `model#{modelId}`. Added by the API; not stored.
   */
  estimatedCostUsd?: {
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
  /** Cost of the user's priced models only. */
  estimatedCostUsd: number;
  /** Last day (YYYY-MM-DD) with usage in the period. */
  lastActiveDate: string;
}

/** `GET /admin/token-usage`: every user's usage over a date range. */
export interface GetAdminTokenUsageResponse {
  /** Per day, all users added together (`userId` is `*`). */
  daily: TokenUsageStats[];
  /** Per user, sorted by all four token kinds added together, largest first. */
  users: UserTokenUsageTotals[];
  /** Per model, largest estimated cost (then tokens) first. */
  models: ModelTokenUsageTotals[];
  /** Total estimated cost of the priced models. */
  estimatedCostUsd: number;
  /** Date of the list prices (YYYY-MM-DD). */
  pricingDate: string;
}

/** List price of a model, USD per 1,000 tokens (on-demand). */
export interface ModelPrice {
  inputPer1k: number;
  outputPer1k: number;
  cacheReadPer1k?: number;
  cacheWritePer1k?: number;
}

/** A model's prices in one Region. */
export interface ModelPrices {
  /** In-Region and geographic cross-Region inference (us., jp., ...). */
  regional?: ModelPrice;
  /** Global cross-Region inference (global.). */
  global?: ModelPrice;
}

/** Usage and estimated cost of one model over the period. */
export interface ModelTokenUsageTotals {
  modelId: string;
  executions: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
  /** Missing when GenU has no list price for the model. */
  estimatedCostUsd?: number;
}
