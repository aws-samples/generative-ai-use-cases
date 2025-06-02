// アプローチ1: L1コンストラクトのaddPropertyOverrideを使用
import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CloudFrontToS3,
  CloudFrontToS3Props,
} from '@aws-solutions-constructs/aws-cloudfront-s3';
import {
  CfnDistribution,
  Distribution,
  ResponseHeadersPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface WebIPv6Props {
  readonly ipv6Enabled: boolean;
  readonly responseHeadersPolicy: ResponseHeadersPolicy;
  // その他のプロパティ...
}

export class WebWithIPv6Override extends Construct {
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: WebIPv6Props) {
    super(scope, id);

    const cloudFrontToS3Props: CloudFrontToS3Props = {
      insertHttpSecurityHeaders: false,
      bucketProps: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      },
      cloudFrontDistributionProps: {
        // IPv6設定はここでは指定しない（後でオーバーライド）
        defaultBehavior: {
          responseHeadersPolicy: props.responseHeadersPolicy,
        },
      },
    };

    const { cloudFrontWebDistribution } = new CloudFrontToS3(
      this,
      'Web',
      cloudFrontToS3Props
    );

    // L1コンストラクトを取得してIPv6設定をオーバーライド
    const cfnDistribution = cloudFrontWebDistribution.node
      .defaultChild as CfnDistribution;
    
    // IPv6設定を明示的にオーバーライド
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.IsIPV6Enabled',
      props.ipv6Enabled
    );

    this.distribution = cloudFrontWebDistribution;
  }
}

// メリット:
// 1. 明示的で分かりやすい
// 2. L2コンストラクトの制限を回避できる
// 3. CloudFormationテンプレートの直接操作

// デメリット:
// 1. L1レベルの操作でタイプセーフティが低い
// 2. CDKのアップデートで破綻する可能性
// 3. プロパティ名の文字列指定でタイポのリスク