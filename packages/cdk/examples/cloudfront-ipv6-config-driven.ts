// アプローチ4: 設定駆動型アプローチ
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

/**
 * CloudFront設定のスキーマ定義
 */
export interface CloudFrontDistributionConfig {
  readonly ipv6: {
    readonly enabled: boolean;
    readonly regions?: string[]; // IPv6を有効にするリージョン（将来的な拡張）
  };
  readonly security: {
    readonly webAclId?: string;
    readonly enforceHttps: boolean;
    readonly httpsVersion: 'http1.1' | 'http2' | 'http2and3';
  };
  readonly performance: {
    readonly priceClass: 'PriceClass_All' | 'PriceClass_200' | 'PriceClass_100';
    readonly compressionEnabled: boolean;
  };
  readonly logging: {
    readonly enabled: boolean;
    readonly includeCookies?: boolean;
    readonly prefix?: string;
  };
}

/**
 * 設定駆動型のCloudFront管理クラス
 */
export class ConfigurableCloudFrontDistribution {
  private readonly config: CloudFrontDistributionConfig;
  private readonly distribution: Distribution;

  constructor(
    scope: Construct,
    id: string,
    config: CloudFrontDistributionConfig,
    additionalProps?: Partial<CloudFrontToS3Props>
  ) {
    this.config = config;

    // 設定の検証
    this.validateConfiguration();

    // バケット設定
    const bucketProps: s3.BucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      enforceSSL: config.security.enforceHttps,
    };

    // CloudFrontToS3の基本設定
    const cloudFrontToS3Props: CloudFrontToS3Props = {
      insertHttpSecurityHeaders: false,
      bucketProps,
      loggingBucketProps: bucketProps,
      cloudFrontLoggingBucketProps: bucketProps,
      cloudFrontLoggingBucketAccessLogBucketProps: bucketProps,
      cloudFrontDistributionProps: {
        // 基本設定はここで行い、詳細設定は後でオーバーライド
        defaultBehavior: {
          compress: config.performance.compressionEnabled,
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
      },
      ...additionalProps,
    };

    // CloudFrontディストリビューションを作成
    const { cloudFrontWebDistribution } = new CloudFrontToS3(
      scope,
      id,
      cloudFrontToS3Props
    );

    // 設定に基づいて詳細なプロパティを適用
    this.applyConfigurationOverrides(cloudFrontWebDistribution);

    this.distribution = cloudFrontWebDistribution;
  }

  /**
   * 設定に基づいてCloudFrontのプロパティをオーバーライド
   */
  private applyConfigurationOverrides(distribution: Distribution): void {
    const cfnDistribution = distribution.node.defaultChild as CfnDistribution;

    // IPv6設定
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.IsIPV6Enabled',
      this.config.ipv6.enabled
    );

    // セキュリティ設定
    if (this.config.security.webAclId) {
      cfnDistribution.addPropertyOverride(
        'DistributionConfig.WebACLId',
        this.config.security.webAclId
      );
    }

    cfnDistribution.addPropertyOverride(
      'DistributionConfig.HttpVersion',
      this.config.security.httpsVersion
    );

    // パフォーマンス設定
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.PriceClass',
      this.config.performance.priceClass
    );

    // ログ設定
    if (this.config.logging.enabled) {
      this.configureLogging(cfnDistribution);
    }
  }

  /**
   * ログ設定の適用
   */
  private configureLogging(cfnDistribution: CfnDistribution): void {
    const loggingConfig: any = {
      Bucket: `${Stack.of(cfnDistribution).stackName}-cloudfront-logs.s3.amazonaws.com`,
      IncludeCookies: this.config.logging.includeCookies || false,
    };

    if (this.config.logging.prefix) {
      loggingConfig.Prefix = this.config.logging.prefix;
    }

    cfnDistribution.addPropertyOverride(
      'DistributionConfig.Logging',
      loggingConfig
    );
  }

  /**
   * 設定の検証
   */
  private validateConfiguration(): void {
    // IPv6設定の検証
    if (this.config.ipv6.enabled && this.config.ipv6.regions) {
      if (this.config.ipv6.regions.length === 0) {
        throw new Error('IPv6 regions cannot be empty when IPv6 is enabled');
      }
    }

    // セキュリティ設定の検証
    if (this.config.security.enforceHttps && 
        this.config.security.httpsVersion === 'http1.1') {
      console.warn('HTTP/1.1 with enforced HTTPS may not be optimal');
    }

    // パフォーマンス設定の検証
    if (this.config.performance.priceClass === 'PriceClass_All' && 
        !this.config.ipv6.enabled) {
      console.warn('PriceClass_All without IPv6 may not be cost-effective');
    }
  }

  /**
   * 現在の設定を取得
   */
  public getConfiguration(): CloudFrontDistributionConfig {
    return { ...this.config };
  }

  /**
   * ディストリビューションを取得
   */
  public getDistribution(): Distribution {
    return this.distribution;
  }

  /**
   * 設定の更新（デプロイメント後）
   */
  public updateConfiguration(
    partialConfig: Partial<CloudFrontDistributionConfig>
  ): void {
    // 実際の運用では、この機能は慎重に実装する必要がある
    console.warn('Configuration update after deployment requires careful consideration');
  }
}

/**
 * 設定ファクトリクラス
 */
export class CloudFrontConfigFactory {
  /**
   * 開発環境用の設定
   */
  static createDevelopmentConfig(): CloudFrontDistributionConfig {
    return {
      ipv6: {
        enabled: false, // 開発環境ではIPv6を無効
      },
      security: {
        enforceHttps: false,
        httpsVersion: 'http2',
      },
      performance: {
        priceClass: 'PriceClass_100',
        compressionEnabled: true,
      },
      logging: {
        enabled: false,
      },
    };
  }

  /**
   * 本番環境用の設定
   */
  static createProductionConfig(webAclId?: string): CloudFrontDistributionConfig {
    return {
      ipv6: {
        enabled: true, // 本番環境ではIPv6を有効
      },
      security: {
        webAclId,
        enforceHttps: true,
        httpsVersion: 'http2and3',
      },
      performance: {
        priceClass: 'PriceClass_All',
        compressionEnabled: true,
      },
      logging: {
        enabled: true,
        includeCookies: false,
        prefix: 'cloudfront-logs/',
      },
    };
  }

  /**
   * IPv6無効化設定
   */
  static createIPv6DisabledConfig(): CloudFrontDistributionConfig {
    return {
      ipv6: {
        enabled: false,
      },
      security: {
        enforceHttps: true,
        httpsVersion: 'http2',
      },
      performance: {
        priceClass: 'PriceClass_200',
        compressionEnabled: true,
      },
      logging: {
        enabled: true,
      },
    };
  }
}

// 使用例
export class ConfigDrivenWebStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 環境に応じた設定の選択
    const environment = this.node.tryGetContext('environment') || 'development';
    
    let config: CloudFrontDistributionConfig;
    switch (environment) {
      case 'production':
        config = CloudFrontConfigFactory.createProductionConfig('waf-id');
        break;
      case 'staging':
        config = CloudFrontConfigFactory.createIPv6DisabledConfig();
        break;
      default:
        config = CloudFrontConfigFactory.createDevelopmentConfig();
    }

    // 設定駆動型のCloudFrontディストリビューションを作成
    const cloudfront = new ConfigurableCloudFrontDistribution(
      this,
      'ConfigurableWeb',
      config
    );

    // 設定の出力
    console.log('CloudFront Configuration:', cloudfront.getConfiguration());
  }
}

// メリット:
// 1. 環境ごとの設定管理が容易
// 2. 設定の一元化と標準化
// 3. バリデーション機能内蔵
// 4. テストが容易
// 5. 設定の再利用性が高い

// デメリット:
// 1. 初期設定の複雑さ
// 2. 過度な抽象化のリスク
// 3. 設定スキーマの維持コスト