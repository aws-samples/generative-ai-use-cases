/**
 * Sanitizes model ID to be compatible with CloudFormation export names
 * Replaces invalid characters with hyphens
 */
export const sanitizeModelId = (modelId: string): string => {
  return modelId.replace(/[^a-zA-Z0-9-]/g, '-');
};

const CROSS_REGION_PROFILE_PREFIX = /^(global|us|us-gov|eu|apac|jp|au|ca)\./;

/**
 * Builds the ARN Bedrock expects for a model ID: an inference-profile ARN for a
 * cross-Region inference profile ID (e.g. global.xxx, us.xxx), otherwise a
 * foundation-model ARN.
 */
export const bedrockModelArn = ({
  modelId,
  region,
  account,
}: {
  modelId: string;
  region: string;
  account: string;
}): string =>
  CROSS_REGION_PROFILE_PREFIX.test(modelId)
    ? `arn:aws:bedrock:${region}:${account}:inference-profile/${modelId}`
    : `arn:aws:bedrock:${region}::foundation-model/${modelId}`;
