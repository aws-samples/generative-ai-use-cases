import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as kendra from 'aws-cdk-lib/aws-kendra';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Duration, Token, Arn, RemovalPolicy } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

const KENDRA_STATE_CFN_PARAMETER_NAME = 'kendraState';

export interface RagProps {
  // Context Params
  readonly envSuffix: string;
  readonly kendraIndexLanguage: string;
  readonly kendraIndexArnInCdkContext?: string | null;
  readonly kendraDataSourceBucketName?: string | null;
  readonly kendraIndexScheduleEnabled: boolean;
  readonly kendraIndexScheduleCreateCron?: IndexScheduleCron | null;
  readonly kendraIndexScheduleDeleteCron?: IndexScheduleCron | null;

  // Resource
  readonly userPool: UserPool;
  readonly api: RestApi;
}

export interface IndexScheduleCron {
  readonly minute: string;
  readonly hour: string;
  readonly month: string;
  readonly weekDay: string;
}

class KendraIndexWithCfnParameter extends kendra.CfnIndex {
  attrId: string;
  attrArn: string;

  constructor(
    scope: Construct,
    id: string,
    props: kendra.CfnIndexProps,
    kendraSwitchCfnCondition: cdk.CfnCondition
  ) {
    super(scope, id, props);

    this.attrId = cdk.Fn.conditionIf(
      kendraSwitchCfnCondition.logicalId,
      this.attrId, // If kendra is on, return attrId
      `` // If kendra is off, set empty string
    ).toString();

    this.attrArn = cdk.Fn.conditionIf(
      kendraSwitchCfnCondition.logicalId,
      this.attrArn, // If kendra is on, return attrArn
      `arn:aws:kendra:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:index/` // If kendra is off, set empty string (Do not allow IAM)
    ).toString();
  }
}

class KendraDataSourceWithCfnParameter extends kendra.CfnDataSource {
  attrId: string;
  attrArn: string;

  constructor(
    scope: Construct,
    id: string,
    props: kendra.CfnDataSourceProps,
    kendraSwitchCfnCondition: cdk.CfnCondition
  ) {
    super(scope, id, props);

    this.attrId = cdk.Fn.conditionIf(
      kendraSwitchCfnCondition.logicalId,
      this.attrId, // If kendra is on, return attrId
      `` // If kendra is off, set empty string
    ).toString();

    this.attrArn = cdk.Fn.conditionIf(
      kendraSwitchCfnCondition.logicalId,
      this.attrArn, // If kendra is on, return attrArn
      `arn:aws:kendra:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:index/*/data-source/` // If kendra is off, set empty string (Do not allow IAM)
    ).toString();
  }
}

/**
 * Create resources for RAG
 */
export class Rag extends Construct {
  public readonly dataSourceBucketName?: string;

  constructor(scope: Construct, id: string, props: RagProps) {
    super(scope, id);

    const {
      envSuffix,
      kendraIndexLanguage,
      kendraIndexArnInCdkContext,
      kendraDataSourceBucketName,
      kendraIndexScheduleEnabled,
      kendraIndexScheduleCreateCron,
      kendraIndexScheduleDeleteCron,
    } = props;

    let kendraIndexArn: string;
    let kendraIndexId: string;
    let dataSourceBucket: s3.IBucket | null = null;

    if (kendraIndexArnInCdkContext) {
      // Use existing Kendra Index
      kendraIndexArn = kendraIndexArnInCdkContext!;
      kendraIndexId = Arn.extractResourceName(
        kendraIndexArnInCdkContext,
        'index'
      );
      // If you use existing S3 data source, generate object from bucket name
      if (kendraDataSourceBucketName) {
        dataSourceBucket = s3.Bucket.fromBucketName(
          this,
          'DataSourceBucket',
          kendraDataSourceBucketName
        );
      }
    } else {
      // Create new Kendra Index
      const indexRole = new iam.Role(this, 'KendraIndexRole', {
        assumedBy: new iam.ServicePrincipal('kendra.amazonaws.com'),
      });

      indexRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: ['*'],
          actions: ['s3:GetObject'],
        })
      );

      indexRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
      );

      const accessLogsBucket = new s3.Bucket(
        this,
        'DataSourceAccessLogsBucket',
        {
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          encryption: s3.BucketEncryption.S3_MANAGED,
          autoDeleteObjects: true,
          removalPolicy: RemovalPolicy.DESTROY,
          objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
          enforceSSL: true,
        }
      );

      // S3 Bucket to store .pdf and .txt documents
      dataSourceBucket = new s3.Bucket(this, 'DataSourceBucket', {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
        objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
        serverAccessLogsBucket: accessLogsBucket,
        serverAccessLogsPrefix: 'AccessLogs/',
        enforceSSL: true,
      });

      // Upload /kendra/docs directory to Bucket
      new s3Deploy.BucketDeployment(this, 'DeployDocs', {
        sources: [s3Deploy.Source.asset('./rag-docs')],
        destinationBucket: dataSourceBucket,
        // There is a possibility that access logs are left in the same Bucket in the previous configuration, so this setting is left
        exclude: [
          'AccessLogs/*',
          'logs*',
          'docs/bedrock-ug.pdf.metadata.json',
          'docs/nova-ug.pdf.metadata.json',
        ],
        prune: false,
        memoryLimit: 1024,
      });

      let index: kendra.CfnIndex;
      const indexProps: kendra.CfnIndexProps = {
        name: `generative-ai-use-cases-index${envSuffix}`,
        edition: 'DEVELOPER_EDITION',
        roleArn: indexRole.roleArn,

        // Implement token-based access control
        // Reference: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-kendra-index.html#cfn-kendra-index-usercontextpolicy
        userContextPolicy: 'USER_TOKEN',

        // Set information about the Cognito used for authorization
        userTokenConfigurations: [
          {
            jwtTokenTypeConfiguration: {
              keyLocation: 'URL',
              userNameAttributeField: 'cognito:username',
              groupAttributeField: 'cognito:groups',
              url: `${props.userPool.userPoolProviderUrl}/.well-known/jwks.json`,
            },
          },
        ],
      };

      let kendraIsOnCfnCondition;
      if (kendraIndexScheduleEnabled) {
        // Load Cloudfomation Parameter
        const kendraStateCfnParameter = new cdk.CfnParameter(
          scope,
          KENDRA_STATE_CFN_PARAMETER_NAME,
          {
            // NOTE Do not use this, use scope
            type: 'String',
            description:
              'parameter to create kendra index. on: create kendra index, off: delete kendra index.',
            allowedValues: ['on', 'off'],
            default: 'on',
          }
        );
        kendraIsOnCfnCondition = new cdk.CfnCondition(
          scope,
          'IsKendraOnCondition',
          {
            expression: cdk.Fn.conditionEquals(
              kendraStateCfnParameter.valueAsString,
              'on'
            ),
          }
        );

        index = new KendraIndexWithCfnParameter(
          this,
          'KendraIndex',
          indexProps,
          kendraIsOnCfnCondition
        );
        index.cfnOptions.condition = kendraIsOnCfnCondition; // According to Cfn Parameter, turn on/off resources

        kendraIndexArn = index.attrArn;
        kendraIndexId = index.attrId;
      } else {
        index = new kendra.CfnIndex(this, 'KendraIndex', indexProps);

        kendraIndexArn = Token.asString(index.getAtt('Arn'));
        kendraIndexId = index.ref;
      }

      const s3DataSourceRole = new iam.Role(this, 'DataSourceRole', {
        assumedBy: new iam.ServicePrincipal('kendra.amazonaws.com'),
      });

      s3DataSourceRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: [`arn:aws:s3:::${dataSourceBucket.bucketName}`],
          actions: ['s3:ListBucket'],
        })
      );

      s3DataSourceRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: [`arn:aws:s3:::${dataSourceBucket.bucketName}/*`],
          actions: ['s3:GetObject'],
        })
      );

      s3DataSourceRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: [index.attrArn],
          actions: ['kendra:BatchPutDocument', 'kendra:BatchDeleteDocument'],
        })
      );

      let dataSource: kendra.CfnDataSource;
      const dataSourceProps: kendra.CfnDataSourceProps = {
        indexId: index.attrId,
        type: 'S3',
        name: 's3-data-source',
        roleArn: s3DataSourceRole.roleArn,
        languageCode: kendraIndexLanguage,
        dataSourceConfiguration: {
          s3Configuration: {
            bucketName: dataSourceBucket.bucketName,
            inclusionPrefixes: ['docs'],
          },
        },
      };
      if (kendraIndexScheduleEnabled) {
        dataSource = new KendraDataSourceWithCfnParameter(
          this,
          'S3DataSource',
          dataSourceProps,
          kendraIsOnCfnCondition as cdk.CfnCondition
        );
        dataSource.cfnOptions.condition = kendraIsOnCfnCondition; // Toggle resources according to Cfn Parameter
      } else {
        dataSource = new kendra.CfnDataSource(
          this,
          'S3DataSource',
          dataSourceProps
        );
      }
      dataSource.addDependency(index);

      if (kendraIndexScheduleEnabled) {
        if (kendraIndexScheduleCreateCron) {
          const taskStartDataSourceSyncJob =
            new stepfunctionsTasks.CallAwsService(
              this,
              'TaskStartDataSourceSyncJob',
              {
                service: 'kendra',
                action: 'startDataSourceSyncJob',
                parameters: {
                  IndexId: index.attrId,
                  Id: dataSource.attrId,
                },
                iamResources: [
                  // NOTE Both index and data source are required
                  index.attrArn,
                  dataSource.attrArn,
                ],
              }
            );

          const definitionStartDataSourceSyncJob = stepfunctions.Chain.start(
            taskStartDataSourceSyncJob
          );

          const stateMachineStartDataSourceSyncJob =
            new stepfunctions.StateMachine(
              this,
              'StepFunctionsStateMachineStartDataSourceSyncJob',
              {
                definitionBody: stepfunctions.DefinitionBody.fromChainable(
                  definitionStartDataSourceSyncJob
                ),
                timeout: cdk.Duration.minutes(180),
              }
            );

          // Step Functions for Kendra On
          const taskUpdateCloudformationStackWithKendraOn =
            new stepfunctionsTasks.CallAwsService(
              this,
              'TaskUpdateCloudformationStackWithKendraOn',
              {
                service: 'cloudformation',
                action: 'updateStack',
                parameters: {
                  StackName: cdk.Stack.of(this).stackName,
                  UsePreviousTemplate: true,
                  Parameters: [
                    {
                      ParameterKey: KENDRA_STATE_CFN_PARAMETER_NAME,
                      ParameterValue: 'on',
                    },
                  ],
                  Capabilities: ['CAPABILITY_IAM'],
                },
                iamResources: [cdk.Stack.of(this).stackId], // NOTE stackId (arn:aws:cloudformation:ap-northeast-1:123456789012:stack/myStack/i-01234567890abcdef0) can be used an Resource ARN
              }
            );

          const taskCheckCloudformationState =
            new stepfunctionsTasks.CallAwsService(
              this,
              'TaskCheckCloudformationState',
              {
                service: 'cloudformation',
                action: 'describeStacks',
                parameters: {
                  StackName: cdk.Stack.of(this).stackName,
                },
                iamResources: [cdk.Stack.of(this).stackId], // NOTE stackId (arn:aws:cloudformation:ap-northeast-1:123456789012:stack/myStack/i-01234567890abcdef0) can be used an Resource ARN
              }
            );

          const taskCallStartDataSourceSyncJob =
            new stepfunctionsTasks.StepFunctionsStartExecution(
              this,
              'TaskCallStateMachineStartDataSourceSyncJob',
              {
                stateMachine: stateMachineStartDataSourceSyncJob,
                integrationPattern: stepfunctions.IntegrationPattern.RUN_JOB,
              }
            );

          const definitionKendraOn = stepfunctions.Chain.start(
            taskUpdateCloudformationStackWithKendraOn
          )
            .next(taskCheckCloudformationState)
            .next(
              new stepfunctions.Choice(
                this,
                'TaskChoiceWithCloudformationState'
              )
                .when(
                  stepfunctions.Condition.stringEquals(
                    '$.Stacks[0].StackStatus',
                    'UPDATE_IN_PROGRESS'
                  ), // Loop until completion
                  new stepfunctions.Wait(this, 'TaskWaitCloudformationChange', {
                    time: stepfunctions.WaitTime.duration(
                      cdk.Duration.minutes(5)
                    ),
                  }).next(taskCheckCloudformationState) // Loop
                )
                .otherwise(
                  // When completed, call the next step
                  // Call the StateMachine of data source sync
                  taskCallStartDataSourceSyncJob
                )
            );

          const stateMachineKendraOn = new stepfunctions.StateMachine(
            this,
            'StepFunctionsStateMachineKendraOn',
            {
              definitionBody:
                stepfunctions.DefinitionBody.fromChainable(definitionKendraOn),
              timeout: cdk.Duration.minutes(180),
            }
          );

          // cronJobKendraOn
          new events.Rule(this, 'CronJobKendraOn', {
            schedule: events.Schedule.cron({
              minute: kendraIndexScheduleCreateCron.minute,
              hour: kendraIndexScheduleCreateCron.hour,
              month: kendraIndexScheduleCreateCron.month,
              weekDay: kendraIndexScheduleCreateCron.weekDay,
            }), // UTC
            targets: [new targets.SfnStateMachine(stateMachineKendraOn, {})],
          });
        }

        if (kendraIndexScheduleDeleteCron) {
          // Step Functions for Kendra Off
          const taskUpdateCloudformationStackWithKendraOff =
            new stepfunctionsTasks.CallAwsService(
              this,
              'TaskUpdateCloudformationStackWithKendraOff',
              {
                service: 'cloudformation',
                action: 'updateStack',
                parameters: {
                  StackName: cdk.Stack.of(this).stackName,
                  UsePreviousTemplate: true,
                  Parameters: [
                    {
                      ParameterKey: KENDRA_STATE_CFN_PARAMETER_NAME,
                      ParameterValue: 'off',
                    },
                  ],
                  Capabilities: ['CAPABILITY_IAM'],
                },
                iamResources: [cdk.Stack.of(this).stackId],
              }
            );

          const definitionKendraOff = stepfunctions.Chain.start(
            taskUpdateCloudformationStackWithKendraOff
          );

          const stateMachineKendraOff = new stepfunctions.StateMachine(
            this,
            'StepFunctionsStateMachineKendraOff',
            {
              definitionBody:
                stepfunctions.DefinitionBody.fromChainable(definitionKendraOff),
              timeout: cdk.Duration.minutes(180),
            }
          );

          // cronJobKendraOff
          new events.Rule(this, 'CronJobKendraOff', {
            schedule: events.Schedule.cron({
              minute: kendraIndexScheduleDeleteCron.minute,
              hour: kendraIndexScheduleDeleteCron.hour,
              month: kendraIndexScheduleDeleteCron.month,
              weekDay: kendraIndexScheduleDeleteCron.weekDay,
            }), // NOTE Specify UTC time
            targets: [new targets.SfnStateMachine(stateMachineKendraOff, {})],
          });
        }
      }
    }

    // Add RAG related APIs
    // Lambda
    const queryFunction = new NodejsFunction(this, 'Query', {
      runtime: Runtime.NODEJS_LATEST,
      entry: './lambda/queryKendra.ts',
      timeout: Duration.minutes(15),
      bundling: {
        // Use new Kendra features, so explicitly bundle AWS SDK
        externalModules: [],
      },
      environment: {
        INDEX_ID: kendraIndexId,
        LANGUAGE: kendraIndexLanguage,
      },
    });
    queryFunction.role?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [kendraIndexArn],
        actions: ['kendra:Query'],
      })
    );

    const retrieveFunction = new NodejsFunction(this, 'Retrieve', {
      runtime: Runtime.NODEJS_LATEST,
      entry: './lambda/retrieveKendra.ts',
      timeout: Duration.minutes(15),
      bundling: {
        // Use new Kendra features, so explicitly bundle AWS SDK
        externalModules: [],
      },
      environment: {
        INDEX_ID: kendraIndexId,
        LANGUAGE: kendraIndexLanguage,
      },
    });
    retrieveFunction.role?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [kendraIndexArn],
        actions: ['kendra:Retrieve'],
      })
    );

    // API Gateway
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [props.userPool],
    });

    const commonAuthorizerProps = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer,
    };
    const ragResource = props.api.root.addResource('rag');

    const queryResource = ragResource.addResource('query');
    // POST: /rag/query
    queryResource.addMethod(
      'POST',
      new LambdaIntegration(queryFunction),
      commonAuthorizerProps
    );

    const retrieveResource = ragResource.addResource('retrieve');
    // POST: /rag/retrieve
    retrieveResource.addMethod(
      'POST',
      new LambdaIntegration(retrieveFunction),
      commonAuthorizerProps
    );

    this.dataSourceBucketName = dataSourceBucket?.bucketName;
  }
}
