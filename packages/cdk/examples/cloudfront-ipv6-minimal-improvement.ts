// アプローチ5: 現在の実装の最小限改善
import { Stack, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CloudFrontToS3,
  CloudFrontToS3Props,
} from '@aws-solutions-constructs/aws-cloudfront-s3';
import {
  CfnDistribution,
  Distribution,
  ResponseHeadersPolicy,
  HeadersFrameOption,
  HeadersReferrerPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';

/**
 * IPv6設定のインターフェース（既存設定の改善）
 */
export interface IPv6Settings {
  readonly enabled: boolean;
  readonly reason?: string; // 無効化の理由を記録
}

/**
 * 現在のWebPropsの改善版
 */
export interface ImprovedWebProps {
  readonly apiEndpointUrl: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly idPoolId: string;
  readonly predictStreamFunctionArn: string;
  readonly ragEnabled: boolean;
  readonly ragKnowledgeBaseEnabled: boolean;
  readonly agentEnabled: boolean;
  readonly selfSignUpEnabled: boolean;
  readonly webAclId?: string;
  readonly modelRegion: string;
  readonly samlAuthEnabled: boolean;
  readonly samlCognitoDomainName?: string | null;
  readonly samlCognitoFederatedIdentityProviderName?: string | null;
  readonly cert?: ICertificate;
  readonly hostName?: string | null;
  readonly domainName?: string | null;
  readonly hostedZoneId?: string | null;
  readonly useCaseBuilderEnabled: boolean;
  
  // IPv6設定の改善
  readonly ipv6Settings: IPv6Settings;
  
  // その他の設定...
}

/**
 * 現在の実装の最小限改善版
 */
export class ImprovedWeb extends Construct {
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: ImprovedWebProps) {
    super(scope, id);

    // IPv6設定のバリデーション
    this.validateIPv6Settings(props.ipv6Settings);

    const cspSaml = props.samlCognitoDomainName
      ? ` https://${props.samlCognitoDomainName}`
      : '';
    const csp = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; media-src 'self' https://*.amazonaws.com; connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com wss://*.amazonaws.com:* https://raw.githubusercontent.com https://api.github.com${cspSaml}; font-src 'self' https://fonts.gstatic.com data:; object-src 'none'; frame-ancestors 'none'; frame-src 'self' https://www.youtube.com/;`;

    // セキュリティヘッダーポリシーの作成
    const responseHeadersPolicy = new ResponseHeadersPolicy(
      this,
      'SecurityHeadersPolicy',
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: csp,
            override: true,
          },
          frameOptions: {
            frameOption: HeadersFrameOption.DENY,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: Duration.days(365 * 2),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
          contentTypeOptions: {
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
        },
      }
    );

    const commonBucketProps: s3.BucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      enforceSSL: true,
    };

    const cloudFrontToS3Props: CloudFrontToS3Props = {
      insertHttpSecurityHeaders: false,
      loggingBucketProps: commonBucketProps,
      bucketProps: commonBucketProps,
      cloudFrontLoggingBucketProps: commonBucketProps,
      cloudFrontLoggingBucketAccessLogBucketProps: commonBucketProps,
      cloudFrontDistributionProps: {
        // IPv6設定は明示的にオーバーライドで管理
        defaultBehavior: {
          responseHeadersPolicy: responseHeadersPolicy,
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
    };

    // カスタムドメイン設定
    if (
      props.cert &&
      props.hostName &&
      props.domainName &&
      props.hostedZoneId
    ) {
      cloudFrontToS3Props.cloudFrontDistributionProps.certificate = props.cert;
      cloudFrontToS3Props.cloudFrontDistributionProps.domainNames = [
        `${props.hostName}.${props.domainName}`,
      ];
    }

    const { cloudFrontWebDistribution } = new CloudFrontToS3(
      this,
      'Web',
      cloudFrontToS3Props
    );

    // IPv6とその他の設定を適用
    this.applyDistributionOverrides(cloudFrontWebDistribution, props);

    this.distribution = cloudFrontWebDistribution;
  }

  /**
   * IPv6設定のバリデーション
   */
  private validateIPv6Settings(ipv6Settings: IPv6Settings): void {
    if (!ipv6Settings.enabled && !ipv6Settings.reason) {
      console.warn(
        'IPv6 is disabled without a documented reason. Consider adding a reason for future reference.'
      );
    }

    if (ipv6Settings.enabled) {
      console.info('IPv6 is enabled for CloudFront distribution');
    } else {
      console.info(
        `IPv6 is disabled for CloudFront distribution. Reason: ${
          ipv6Settings.reason || 'Not specified'
        }`
      );
    }
  }

  /**
   * ディストリビューションのオーバーライド設定を適用
   */
  private applyDistributionOverrides(
    distribution: Distribution,
    props: ImprovedWebProps
  ): void {
    const cfnDistribution = distribution.node.defaultChild as CfnDistribution;

    // IPv6設定の適用（明示的なオーバーライド）
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.IsIPV6Enabled',
      props.ipv6Settings.enabled
    );

    // WAF設定の適用
    if (props.webAclId) {
      cfnDistribution.addPropertyOverride(
        'DistributionConfig.WebACLId',
        props.webAclId
      );
    }

    // セキュリティ強化設定
    this.applySecurityEnhancements(cfnDistribution);

    // メタデータとタグの追加
    this.addMetadata(cfnDistribution, props);
  }

  /**
   * セキュリティ強化設定の適用
   */
  private applySecurityEnhancements(cfnDistribution: CfnDistribution): void {
    // HTTP/2とHTTP/3の有効化
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.HttpVersion',
      'http2and3'
    );

    // デフォルトルートオブジェクトの設定
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.DefaultRootObject',
      'index.html'
    );
  }

  /**
   * メタデータとタグの追加
   */
  private addMetadata(
    cfnDistribution: CfnDistribution,
    props: ImprovedWebProps
  ): void {
    // CloudFormationメタデータの追加
    cfnDistribution.addMetadata('IPv6Enabled', props.ipv6Settings.enabled);
    if (props.ipv6Settings.reason) {
      cfnDistribution.addMetadata('IPv6DisabledReason', props.ipv6Settings.reason);
    }

    // タグの追加
    const tags = [
      {
        Key: 'IPv6Enabled',
        Value: props.ipv6Settings.enabled.toString(),
      },
      {
        Key: 'Component',
        Value: 'WebDistribution',
      },
    ];

    if (props.ipv6Settings.reason) {
      tags.push({
        Key: 'IPv6DisabledReason',
        Value: props.ipv6Settings.reason,
      });
    }

    cfnDistribution.addPropertyOverride('Tags', tags);
  }

  /**
   * 現在のIPv6設定を取得
   */
  public getIPv6Settings(): IPv6Settings {
    return {
      enabled: this.node.tryGetContext('ipv6Enabled') ?? true,
      reason: this.node.tryGetContext('ipv6DisabledReason'),
    };
  }
}

/**
 * 使用例とマイグレーションパス
 */
export class MigrationExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 現在の設定からの移行例
    const web = new ImprovedWeb(this, 'ImprovedWeb', {
      // 既存のプロパティ
      apiEndpointUrl: 'https://api.example.com',
      userPoolId: 'user-pool-id',
      userPoolClientId: 'client-id',
      idPoolId: 'id-pool-id',
      predictStreamFunctionArn: 'function-arn',
      ragEnabled: false,
      ragKnowledgeBaseEnabled: false,
      agentEnabled: false,
      selfSignUpEnabled: true,
      modelRegion: 'us-east-1',
      samlAuthEnabled: false,
      useCaseBuilderEnabled: true,

      // 改善されたIPv6設定
      ipv6Settings: {
        enabled: false,
        reason: 'Disabled due to regional compliance requirements',
      },
    });

    // 設定の確認
    console.log('Current IPv6 Settings:', web.getIPv6Settings());
  }
}

// 既存コードからの移行マップ
export const MIGRATION_GUIDE = {
  before: {
    // 既存の設定
    cloudFrontIPv6Enabled: true,
  },
  after: {
    // 新しい設定
    ipv6Settings: {
      enabled: true,
      reason: undefined, // enabledがtrueの場合、reasonは不要
    },
  },
  steps: [
    '1. WebPropsにipv6Settingsプロパティを追加',
    '2. cloudFrontIPv6Enabledからipv6Settings.enabledに変更',
    '3. 必要に応じてipv6Settings.reasonを追加',
    '4. validateIPv6Settings()メソッドでバリデーション追加',
    '5. メタデータとタグの追加でトレーサビリティ向上',
  ],
};

// メリット:
// 1. 既存コードへの影響を最小限に抑制
// 2. 段階的な移行が可能
// 3. バリデーションとロギングの追加
// 4. メタデータによるトレーサビリティ向上
// 5. 後方互換性の維持

// デメリット:
// 1. 根本的な改善には限界
// 2. 技術的負債の完全な解消にはならない
// 3. 一部の複雑性は残存