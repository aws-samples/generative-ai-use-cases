import { Annotations } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { getEndOfLife, modelMetadata } from '@generative-ai-use-cases/common';

const LIFECYCLE_DOC =
  'https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle-legacy.html';

// Adds a synth-time warning for each model that Bedrock has retired or will
// retire. It never fails the deployment: a retired model only fails when it is
// called, so the warning tells you to remove it before users hit the error.
// The message names the parameter to edit, so it reads on its own.
export const warnModelEndOfLife = ({
  scope,
  parameter,
  modelIds,
  today,
}: {
  scope: Construct;
  // Deploy parameter the models come from, e.g. modelIds
  parameter: string;
  modelIds: string[];
  today?: Date;
}): void => {
  for (const modelId of new Set(modelIds)) {
    const endOfLife = getEndOfLife({ modelId, today });
    if (!endOfLife) continue;

    const name = modelMetadata[modelId]?.displayName ?? modelId;
    const subject = `${name} (${modelId}) in ${parameter}`;
    const fix = `Replace it with an active model or remove it from ${parameter}. This warning does not stop the deployment.`;
    // Dates are the earliest announced for any Region, so a dated model may
    // still answer in a Region whose EOL comes later. Only an undated retired
    // model is gone everywhere.
    const message =
      endOfLife.state === 'retired'
        ? `${subject} is no longer offered on Amazon Bedrock, so requests to it fail. ${fix}`
        : endOfLife.state === 'ended'
          ? `${subject} reached end of life on Amazon Bedrock on ${endOfLife.date} in at least one Region, where requests to it now fail. ${fix} Status by Region: ${LIFECYCLE_DOC}`
          : `${subject} will reach end of life on Amazon Bedrock on ${endOfLife.date} (in ${endOfLife.daysLeft} days) in at least one Region. ${fix} Status by Region: ${LIFECYCLE_DOC}`;
    Annotations.of(scope).addWarningV2(
      `@generative-ai-use-cases/model-end-of-life:${parameter}:${modelId}`,
      message
    );
  }
};
