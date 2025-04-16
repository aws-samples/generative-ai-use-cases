import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { ProcessedStackInput } from './stack-input';
import { ModelConfiguration } from 'generative-ai-use-cases';

export interface DashboardStackProps extends StackProps {
  readonly params: ProcessedStackInput;
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly appRegion: string;
}

export class DashboardStack extends Stack {
  public readonly logGroup: logs.LogGroup;
  public readonly dashboard: cw.Dashboard;

  constructor(scope: Construct, id: string, props: DashboardStackProps) {
    super(scope, id, props);

    const params = props.params;

    // LogGroup for Bedrock logs
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      // Retain logs for 1 year
      retention: logs.RetentionDays.ONE_YEAR,
    });

    const inputTokenCounts = params.modelIds.map(
      (model: ModelConfiguration) => {
        return new cw.Metric({
          namespace: 'AWS/Bedrock',
          metricName: 'InputTokenCount',
          dimensionsMap: {
            ModelId: model.modelId,
          },
          region: model.region,
          period: Duration.days(1),
          statistic: 'Sum',
        });
      }
    );

    const outputTokenCounts = params.modelIds.map(
      (model: ModelConfiguration) => {
        return new cw.Metric({
          namespace: 'AWS/Bedrock',
          metricName: 'OutputTokenCount',
          dimensionsMap: {
            ModelId: model.modelId,
          },
          region: model.region,
          period: Duration.days(1),
          statistic: 'Sum',
        });
      }
    );

    const invocations = [
      ...params.modelIds,
      ...params.imageGenerationModelIds,
    ].map((model: ModelConfiguration) => {
      return new cw.Metric({
        namespace: 'AWS/Bedrock',
        metricName: 'Invocations',
        dimensionsMap: {
          ModelId: model.modelId,
        },
        region: model.region,
        period: Duration.days(1),
        statistic: 'Sum',
      });
    });

    const userPoolMetrics = [
      'SignInSuccesses',
      'TokenRefreshSuccesses',
      'SignUpSuccesses',
    ].map((metricName: string) => {
      return new cw.Metric({
        namespace: 'AWS/Cognito',
        metricName,
        dimensionsMap: {
          UserPool: props.userPool.userPoolId,
          UserPoolClient: props.userPoolClient.userPoolClientId,
        },
        period: Duration.hours(1),
        statistic: 'Sum',
        region: props.appRegion,
      });
    });

    const dashboard = new cw.Dashboard(this, 'Dashboard', {
      defaultInterval: Duration.days(7),
    });

    dashboard.addWidgets(
      new cw.TextWidget({
        markdown: '**Amazon Bedrock Metrics**',
        width: 18,
        height: 1,
      }),
      new cw.TextWidget({
        markdown: '**User Metrics**',
        width: 6,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cw.GraphWidget({
        title: 'InputTokenCount (Daily)',
        width: 6,
        height: 6,
        left: inputTokenCounts,
      }),
      new cw.GraphWidget({
        title: 'OutputTokenCount (Daily)',
        width: 6,
        height: 6,
        left: outputTokenCounts,
      }),
      new cw.GraphWidget({
        title: 'Invocations (Daily)',
        width: 6,
        height: 6,
        left: invocations,
      }),
      new cw.GraphWidget({
        title: 'UserPool',
        width: 6,
        height: 6,
        left: userPoolMetrics,
      })
    );

    dashboard.addWidgets(
      new cw.TextWidget({
        markdown: '**Prompt Logs**',
        width: 24,
        height: 1,
      })
    );

    // Extract logs from the output
    dashboard.addWidgets(
      new cw.LogQueryWidget({
        title: 'Prompt Logs',
        width: 24,
        height: 6,
        logGroupNames: [logGroup.logGroupName],
        view: cw.LogQueryVisualizationType.TABLE,
        queryLines: [
          "filter @logStream = 'aws/bedrock/modelinvocations'",
          "filter schemaType like 'ModelInvocationLog'",
          'filter concat(input.inputBodyJson.prompt, input.inputBodyJson.messages.0.content.0.text) not like /.*<conversation>.*/',
          'sort @timestamp desc',
          'fields @timestamp, concat(input.inputBodyJson.prompt, input.inputBodyJson.messages.0.content.0.text) as input, modelId',
        ],
      })
    );

    this.logGroup = logGroup;
    this.dashboard = dashboard;

    new CfnOutput(this, 'BedrockLogGroup', {
      value: this.logGroup.logGroupName,
    });

    new CfnOutput(this, 'DashboardName', {
      value: this.dashboard.dashboardName,
    });

    new CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home#dashboards/dashboard/${this.dashboard.dashboardName}`,
    });
  }
}
