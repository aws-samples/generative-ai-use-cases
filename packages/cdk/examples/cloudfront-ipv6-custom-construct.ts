// アプローチ3: カスタムConstructによる改善
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
  ViewerProtocolPolicy,
  AllowedMethods,
  CachedMethods,
} from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';

/**
 * CloudFront IPv6設定の詳細オプション
 */
export interface IPv6Configuration {
  readonly enabled: boolean;
  readonly enforceHttps?: boolean;
  readonly priceClass?: 'PriceClass_All' | 'PriceClass_200' | 'PriceClass_100';
}

/**
 * Web配信のためのCloudFront設定
 */
export interface EnhancedWebProps {
  readonly ipv6Config: IPv6Configuration;
  readonly responseHeadersPolicy: ResponseHeadersPolicy;
  readonly webAclId?: string;
  readonly domainConfig?: {
    domainNames: string[];
    certificate: ICertificate;
  };
  readonly bucketProps?: Partial<s3.BucketProps>;
}

/**
 * 改善されたWebコンストラクト
 */
export class EnhancedWeb extends Construct {
  public readonly distribution: Distribution;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: EnhancedWebProps) {
    super(scope, id);

    // デフォルトのバケット設定
    const defaultBucketProps: s3.BucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      enforceSSL: true,
      ...props.bucketProps,
    };

    // CloudFrontToS3の設定
    const cloudFrontToS3Props: CloudFrontToS3Props = {
      insertHttpSecurityHeaders: false,
      bucketProps: defaultBucketProps,
      loggingBucketProps: defaultBucketProps,
      cloudFrontLoggingBucketProps: defaultBucketProps,
      cloudFrontLoggingBucketAccessLogBucketProps: defaultBucketProps,
      cloudFrontDistributionProps: {
        // IPv6設定は後でオーバーライドするため、ここでは設定しない
        defaultBehavior: {
          responseHeadersPolicy: props.responseHeadersPolicy,
          viewerProtocolPolicy: props.ipv6Config.enforceHttps
            ? ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            : ViewerProtocolPolicy.ALLOW_ALL,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
        },
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
        // ドメイン設定（オプション）
        ...(props.domainConfig && {
          domainNames: props.domainConfig.domainNames,
          certificate: props.domainConfig.certificate,
        }),
      },
    };

    // CloudFrontToS3コンストラクトを作成
    const { cloudFrontWebDistribution, s3BucketInterface } = new CloudFrontToS3(
      this,
      'WebDistribution',
      cloudFrontToS3Props
    );

    // L1コンストラクトを取得して詳細設定を適用
    const cfnDistribution = cloudFrontWebDistribution.node
      .defaultChild as CfnDistribution;

    this.applyAdvancedConfiguration(cfnDistribution, props);

    this.distribution = cloudFrontWebDistribution;
    this.bucket = s3BucketInterface as s3.Bucket;
  }

  /**
   * 高度なCloudFront設定を適用
   */
  private applyAdvancedConfiguration(
    cfnDistribution: CfnDistribution,
    props: EnhancedWebProps
  ): void {
    // IPv6設定
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.IsIPV6Enabled',
      props.ipv6Config.enabled
    );

    // Price Class設定
    if (props.ipv6Config.priceClass) {
      cfnDistribution.addPropertyOverride(
        'DistributionConfig.PriceClass',
        props.ipv6Config.priceClass
      );
    }

    // WAF設定
    if (props.webAclId) {
      cfnDistribution.addPropertyOverride(
        'DistributionConfig.WebACLId',
        props.webAclId
      );
    }

    // その他のセキュリティ設定
    this.applySecurityConfiguration(cfnDistribution);
  }

  /**
   * セキュリティ関連の設定を適用
   */
  private applySecurityConfiguration(cfnDistribution: CfnDistribution): void {
    // HTTP/2とHTTP/3の有効化
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.HttpVersion',
      'http2and3'
    );

    // IPv6使用時の追加セキュリティ設定
    if (this.node.tryGetContext('cloudFrontIPv6Enabled') !== false) {
      // IPv6固有のセキュリティ設定をここに追加
    }
  }

  /**
   * IPv6設定の検証
   */
  public validateIPv6Configuration(): void {
    const ipv6Enabled = this.node.tryGetContext('cloudFrontIPv6Enabled');
    if (ipv6Enabled === undefined) {
      console.warn('IPv6 configuration not explicitly set, using default');
    }
  }
}

// 使用例
export class ImprovedWebStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const responseHeadersPolicy = new ResponseHeadersPolicy(
      this,
      'SecurityHeaders',
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: "default-src 'self'",
            override: true,
          },
        },
      }
    );

    const web = new EnhancedWeb(this, 'EnhancedWeb', {
      ipv6Config: {
        enabled: false, // IPv6を無効に設定
        enforceHttps: true,
        priceClass: 'PriceClass_100',
      },
      responseHeadersPolicy,
      webAclId: 'optional-waf-id',
    });

    // 設定の検証
    web.validateIPv6Configuration();
  }
}

// メリット:
// 1. 型安全性が高い
// 2. 設定の一元管理
// 3. バリデーション機能内蔵
// 4. テスタビリティが高い
// 5. 拡張性に優れる

// デメリット:
// 1. 初期実装コストが高い
// 2. 既存コードの大幅な変更が必要
// 3. メンテナンスコストの増加