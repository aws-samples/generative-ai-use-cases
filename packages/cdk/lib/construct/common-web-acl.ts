import { Lazy, Names } from 'aws-cdk-lib';
import { CfnIPSet, CfnWebACL, CfnWebACLProps } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface CommonWebAclProps {
  readonly scope: 'REGIONAL' | 'CLOUDFRONT';
  readonly allowedIpV4AddressRanges?: string[] | null;
  readonly allowedIpV6AddressRanges?: string[] | null;
  readonly allowedCountryCodes?: string[] | null;
}

export class CommonWebAcl extends Construct {
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: CommonWebAclProps) {
    super(scope, id);

    const suffix = Lazy.string({ produce: () => Names.uniqueId(this) });

    const rules: CfnWebACLProps['rules'] = [];

    const commonRulePropreties = (name: string) => ({
      name,
      action: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: name,
      },
    });

    const generateIpSetRule = (
      priority: number,
      name: string,
      ipSetArn: string
    ): CfnWebACL.RuleProperty => ({
      priority,
      ...commonRulePropreties(name),
      statement: {
        ipSetReferenceStatement: {
          arn: ipSetArn,
        },
      },
    });

    const generateIpSetAndGeoMatchRule = (
      priority: number,
      name: string,
      ipSetArn: string,
      allowedCountryCodes: string[]
    ): CfnWebACL.RuleProperty => ({
      priority,
      ...commonRulePropreties(name),
      statement: {
        // The condition between rules is OR, so specify AND condition within the same rule
        andStatement: {
          statements: [
            {
              ipSetReferenceStatement: {
                arn: ipSetArn,
              },
            },
            {
              geoMatchStatement: {
                countryCodes: allowedCountryCodes,
              },
            },
          ],
        },
      },
    });

    const hasAllowedIpV4 =
      props.allowedIpV4AddressRanges &&
      props.allowedIpV4AddressRanges.length > 0;
    const hasAllowedIpV6 =
      props.allowedIpV6AddressRanges &&
      props.allowedIpV6AddressRanges.length > 0;
    const hasAllowedCountryCodes =
      props.allowedCountryCodes && props.allowedCountryCodes.length > 0;

    // Define rules for IP v4 and v6 respectively
    if (hasAllowedIpV4) {
      const wafIPv4Set = new CfnIPSet(this, `IPv4Set${id}`, {
        ipAddressVersion: 'IPV4',
        scope: props.scope,
        addresses: props.allowedIpV4AddressRanges ?? [],
      });
      if (hasAllowedCountryCodes) {
        // If you want to perform Geo restriction, specify AND condition with IP restriction
        rules.push(
          generateIpSetAndGeoMatchRule(
            1,
            `IpV4SetAndGeoMatchRule${id}`,
            wafIPv4Set.attrArn,
            props.allowedCountryCodes ?? []
          )
        );
      } else {
        rules.push(
          generateIpSetRule(1, `IpV4SetRule${id}`, wafIPv4Set.attrArn)
        );
      }
    }

    if (hasAllowedIpV6) {
      const wafIPv6Set = new CfnIPSet(this, `IPv6Set${id}`, {
        ipAddressVersion: 'IPV6',
        scope: props.scope,
        addresses: props.allowedIpV6AddressRanges ?? [],
      });
      if (hasAllowedCountryCodes) {
        // If you want to perform Geo restriction, specify AND condition with IP restriction
        rules.push(
          generateIpSetAndGeoMatchRule(
            2,
            `IpV6SetAndGeoMatchRule${id}`,
            wafIPv6Set.attrArn,
            props.allowedCountryCodes ?? []
          )
        );
      } else {
        rules.push(
          generateIpSetRule(2, `IpV6SetRule${id}`, wafIPv6Set.attrArn)
        );
      }
    }

    // If there is no IP restriction and only Geo restriction, define the Geo restriction rule
    if (!hasAllowedIpV4 && !hasAllowedIpV6 && hasAllowedCountryCodes) {
      const name = `GeoMatchRule${id}`;
      rules.push({
        priority: 3,
        ...commonRulePropreties(name),
        statement: {
          geoMatchStatement: {
            countryCodes: props.allowedCountryCodes ?? [],
          },
        },
      });
    }

    const webAcl = new CfnWebACL(this, `WebAcl${id}`, {
      defaultAction: { block: {} },
      name: `WebAcl-${suffix}`,
      scope: props.scope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: `WebAcl-${suffix}`,
      },
      rules: rules,
    });
    this.webAclArn = webAcl.attrArn;
  }
}
