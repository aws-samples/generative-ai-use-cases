import { Annotations } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { getEndOfLife, modelMetadata } from '@generative-ai-use-cases/common';

const LIFECYCLE_DOC =
  'https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle-legacy.html';

// Adds a synth-time warning for each model that Bedrock has retired or will
// retire. It never fails the deployment: a retired model only fails when it is
// called, so the warning tells you to remove it before users hit the error.
export const warnModelEndOfLife = ({
  scope,
  modelIds,
  today,
}: {
  scope: Construct;
  modelIds: string[];
  today?: Date;
}): void => {
  for (const modelId of new Set(modelIds)) {
    const endOfLife = getEndOfLife({ modelId, today });
    if (!endOfLife) continue;

    const name = modelMetadata[modelId]?.displayName ?? modelId;
    const subject = `Model ${name} (${modelId})`;
    // Dates are the earliest announced for any Region, so a dated model may
    // still answer in a Region whose EOL comes later. Only an undated retired
    // model is gone everywhere.
    const check = `Check the status in the Region you use: ${LIFECYCLE_DOC}`;
    const message =
      endOfLife.state === 'retired'
        ? `${subject} is no longer offered on Amazon Bedrock, so requests to it fail. Replace it with an active model in the model parameters.`
        : endOfLife.state === 'ended'
          ? `${subject} reached end of life on Amazon Bedrock on ${endOfLife.date} in at least one Region, where requests to it fail. Replace it with an active model in the model parameters. ${check}`
          : `${subject} will reach end of life on Amazon Bedrock on ${endOfLife.date} (in ${endOfLife.daysLeft} days) in at least one Region. Move to an active model before then. ${check}`;
    Annotations.of(scope).addWarningV2(
      `@generative-ai-use-cases/model-end-of-life:${modelId}`,
      message
    );
  }
};
