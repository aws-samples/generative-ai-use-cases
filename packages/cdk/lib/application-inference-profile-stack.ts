import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CfnApplicationInferenceProfile,
  FoundationModel,
} from 'aws-cdk-lib/aws-bedrock';
import { ProcessedStackInput } from './stack-input';

export interface ApplicationInferenceProfileStackProps extends StackProps {
  readonly params: ProcessedStackInput;
}

export class ApplicationInferenceProfileStack extends Stack {
  public readonly inferenceProfileArns: Record<string, string> = {};

  constructor(
    scope: Construct,
    id: string,
    props: ApplicationInferenceProfileStackProps
  ) {
    super(scope, id, props);
    const params = props.params;
    const currentRegion = props.env?.region;

    const createInferenceProfiles = (modelIds: typeof params.modelIds) => {
      for (const modelId of modelIds) {
        // Inference Profile is not supported Cross Region Inference
        if (
          modelId.region === currentRegion &&
          !modelId.modelId.startsWith('us.') &&
          !modelId.modelId.startsWith('apac.') &&
          !modelId.modelId.startsWith('eu.')
        ) {
          const inferenceProfileNamePrefix = modelId.modelId
            .replace(/\./g, '-')
            .replace(/:/g, '-');
          const model = FoundationModel.fromFoundationModelId(
            this,
            `FoundationModel${inferenceProfileNamePrefix}`,
            {
              modelId: modelId.modelId,
            }
          );
          const inferenceProfile = new CfnApplicationInferenceProfile(
            this,
            `ApplicationInferenceProfile${model.modelId}`,
            {
              inferenceProfileName: `${inferenceProfileNamePrefix}${params.env}`,
              modelSource: {
                copyFrom: model.modelArn,
              },
            }
          );
          this.inferenceProfileArns[modelId.modelId] =
            inferenceProfile.attrInferenceProfileArn;
        }
      }
    };

    createInferenceProfiles(params.modelIds);
    createInferenceProfiles(params.imageGenerationModelIds);
    createInferenceProfiles(params.videoGenerationModelIds);
    createInferenceProfiles(params.speechToSpeechModelIds);
  }
}
