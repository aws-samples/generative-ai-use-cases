import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Bucket,
  BucketEncryption,
  BlockPublicAccess,
} from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ProcessedStackInput } from './stack-input';

export interface VideoTmpBucketStackProps extends StackProps {
  readonly params: ProcessedStackInput;
}

export class VideoTmpBucketStack extends Stack {
  public readonly bucketName: string;

  constructor(scope: Construct, id: string, props: VideoTmpBucketStackProps) {
    super(scope, id, props);
    const params = props.params;

    const bucket = new Bucket(this, 'Bucket', {
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    // Allow cross-account access when Bedrock is used in a different account
    if (params.crossAccountBedrockRoleArn) {
      bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [new iam.ArnPrincipal(params.crossAccountBedrockRoleArn)],
          actions: ['s3:PutObject'],
          resources: [bucket.arnForObjects('*')],
        })
      );
    }

    this.bucketName = bucket.bucketName;
  }
}
