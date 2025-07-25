import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IVpc, SubnetFilter, SubnetType } from 'aws-cdk-lib/aws-ec2';
import {
  PrivateHostedZone,
  ARecord,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  Cluster,
  ContainerImage,
  CpuArchitecture,
  OperatingSystemFamily,
} from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface ClosedWebProps {
  vpc: IVpc;
  subnetIds?: string[] | null;
  // For HTTPS listener
  hostedZone?: PrivateHostedZone;
  certificateArn?: string | null;
}

export class ClosedWeb extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly alb: ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ClosedWebProps) {
    super(scope, id);

    const bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      enforceSSL: true,
    });

    const cluster = new Cluster(this, 'Cluster', { vpc: props.vpc });

    const httpsProps =
      props.hostedZone && props.certificateArn
        ? {
            certificate: Certificate.fromCertificateArn(
              this,
              'Certificate',
              props.certificateArn
            ),
            domainZone: props.hostedZone,
          }
        : {};

    const service = new ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskImageOptions: {
        image: ContainerImage.fromAsset('./fargate-s3-server', {
          platform: Platform.LINUX_AMD64,
        }),
        containerPort: 8080,
        environment: {
          BUCKET_NAME: bucket.bucketName,
        },
      },
      publicLoadBalancer: false,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.X86_64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
      taskSubnets: props.subnetIds
        ? {
            subnetFilters: [SubnetFilter.byIds(props.subnetIds)],
          }
        : {
            subnetType: SubnetType.PRIVATE_ISOLATED,
          },
      ...httpsProps,
    });

    service.targetGroup.configureHealthCheck({
      path: '/healthcheck',
    });

    bucket.grantRead(service.taskDefinition.taskRole);

    if (props.hostedZone) {
      new ARecord(this, 'LbRecord', {
        zone: props.hostedZone,
        target: RecordTarget.fromAlias(
          new LoadBalancerTarget(service.loadBalancer)
        ),
      });
    }

    this.bucket = bucket;
    this.alb = service.loadBalancer;
  }
}
