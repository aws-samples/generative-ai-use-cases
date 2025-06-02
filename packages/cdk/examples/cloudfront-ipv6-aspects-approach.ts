// アプローチ2: CDK Aspectsを使用
import { IAspect, Aspects, Stack } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { CfnDistribution } from 'aws-cdk-lib/aws-cloudfront';

/**
 * CloudFront IPv6設定を管理するAspect
 */
export class CloudFrontIPv6Aspect implements IAspect {
  constructor(private readonly ipv6Enabled: boolean) {}

  visit(node: IConstruct): void {
    // CfnDistributionノードを見つけて設定を適用
    if (node instanceof CfnDistribution) {
      node.addPropertyOverride(
        'DistributionConfig.IsIPV6Enabled',
        this.ipv6Enabled
      );
    }
  }
}

/**
 * より高度なCloudFront設定管理Aspect
 */
export class CloudFrontConfigurationAspect implements IAspect {
  constructor(
    private readonly config: {
      ipv6Enabled: boolean;
      priceClass?: string;
      webAclId?: string;
    }
  ) {}

  visit(node: IConstruct): void {
    if (node instanceof CfnDistribution) {
      // IPv6設定
      node.addPropertyOverride(
        'DistributionConfig.IsIPV6Enabled',
        this.config.ipv6Enabled
      );

      // Price Class設定（オプション）
      if (this.config.priceClass) {
        node.addPropertyOverride(
          'DistributionConfig.PriceClass',
          this.config.priceClass
        );
      }

      // WAF設定（オプション）
      if (this.config.webAclId) {
        node.addPropertyOverride(
          'DistributionConfig.WebACLId',
          this.config.webAclId
        );
      }
    }
  }
}

// 使用例
export class ExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // アプローチ2a: 単純なIPv6制御
    Aspects.of(this).add(new CloudFrontIPv6Aspect(false));

    // アプローチ2b: 包括的なCloudFront設定
    Aspects.of(this).add(
      new CloudFrontConfigurationAspect({
        ipv6Enabled: false,
        priceClass: 'PriceClass_100',
        webAclId: 'some-waf-id',
      })
    );

    // CloudFrontディストリビューションを作成
    // Aspectsが自動的に設定を適用
  }
}

// メリット:
// 1. スタック全体の一元的な制御
// 2. 設定の分離と再利用性
// 3. 複数のCloudFrontディストリビューションに自動適用
// 4. テスタビリティが高い

// デメリット:
// 1. Aspectsの概念が複雑
// 2. デバッグが困難な場合がある
// 3. 予期しない適用が発生する可能性