import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
  ICertificate,
} from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { CommonWebAcl } from './construct/common-web-acl';
import { ProcessedStackInput } from './stack-input';

interface CloudFrontWafStackProps extends StackProps {
  readonly params: ProcessedStackInput;
}

export class CloudFrontWafStack extends Stack {
  public readonly webAclArn: string;
  public readonly webAcl: CommonWebAcl;
  public readonly cert: ICertificate;

  constructor(scope: Construct, id: string, props: CloudFrontWafStackProps) {
    super(scope, id, props);

    const params = props.params;

    if (
      params.allowedIpV4AddressRanges ||
      params.allowedIpV6AddressRanges ||
      params.allowedCountryCodes
    ) {
      const webAcl = new CommonWebAcl(this, `WebAcl${id}`, {
        scope: 'CLOUDFRONT',
        allowedIpV4AddressRanges: params.allowedIpV4AddressRanges,
        allowedIpV6AddressRanges: params.allowedIpV6AddressRanges,
        allowedCountryCodes: params.allowedCountryCodes,
      });

      new CfnOutput(this, 'WebAclId', {
        value: webAcl.webAclArn,
      });
      this.webAclArn = webAcl.webAclArn;
      this.webAcl = webAcl;
    }

    if (params.hostName && params.domainName && params.hostedZoneId) {
      const hostedZone = HostedZone.fromHostedZoneAttributes(
        this,
        'HostedZone',
        {
          hostedZoneId: params.hostedZoneId,
          zoneName: params.domainName,
        }
      );
      const cert = new Certificate(this, 'Cert', {
        domainName: `${params.hostName}.${params.domainName}`,
        validation: CertificateValidation.fromDns(hostedZone),
      });
      this.cert = cert;
    }
  }
}
