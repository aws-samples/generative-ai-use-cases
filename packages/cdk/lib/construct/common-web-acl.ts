import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { CfnIPSet, CfnWebACL, CfnWebACLProps } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface CommonWebAclProps {
    env: {'region':'us-east-1'};
    scope: 'REGIONAL' | 'CLOUDFRONT';
    allowedIpV4AddressRanges: string[] | null;
    allowedIpV6AddressRanges: string[] | null;
}


export class CommonWebAcl extends Construct{
    public readonly webAcl: CfnWebACL;
    public readonly webAclArn: CfnOutput;

    constructor(scope: Construct, id: string, props: CommonWebAclProps){
        super(scope, id);

        const rules: CfnWebACLProps['rules'] = [];
        
        const generateIpSetRule = (
            priority: number,
            name: string,
            ipSetArn: string
        ) => ({
            priority,
            name,
            action: { allow: {}},
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: name,
            },
            statement: {
                ipSetReferenceStatement:{
                    arn: ipSetArn
                },
            },
        });



        if (props.allowedIpV4AddressRanges){
            const wafIPv4Set = new CfnIPSet(this, `IPv4Set${id}`, {
                ipAddressVersion: 'IPV4',
                scope: props.scope,
                addresses: props.allowedIpV4AddressRanges
            });
            rules.push(generateIpSetRule(1, `IpV4SetRule${id}`, wafIPv4Set.attrArn))
        }

        if (props.allowedIpV6AddressRanges){
            const wafIPv6Set = new CfnIPSet(this, `IPv6Set${id}`,{
                ipAddressVersion: 'IPV6',
                scope: props.scope,
                addresses: props.allowedIpV6AddressRanges
            })
            rules.push(generateIpSetRule(2, `IpV6SetRule${id}`, wafIPv6Set.attrArn))
        }
        
        const webAcl = new CfnWebACL(this, `WebAcl${id}`,{
            defaultAction: {block: {}},
            name: `WebAcl${id}`,
            scope: props.scope,
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                sampledRequestsEnabled: true,
                metricName: `WebAcl${id}`,
            },
            rules: rules
        });
        this.webAcl = webAcl;
    }
}