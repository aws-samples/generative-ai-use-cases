import { Construct } from 'constructs';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';

export class Database extends Construct {
  public readonly table: ddb.Table;
  public readonly tokenUsageTable: ddb.Table;
  public readonly tokenUsageByUsecaseTable: ddb.Table;
  public readonly tokenUsageByModelTable: ddb.Table;
  public readonly feedbackIndexName: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const feedbackIndexName = 'FeedbackIndex';
    const table = new ddb.Table(this, 'Table', {
      partitionKey: {
        name: 'id',
        type: ddb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdDate',
        type: ddb.AttributeType.STRING,
      },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
    });

    table.addGlobalSecondaryIndex({
      indexName: feedbackIndexName,
      partitionKey: {
        name: 'feedback',
        type: ddb.AttributeType.STRING,
      },
    });

    // Main table for daily aggregation
    const tokenUsageTable = new ddb.Table(this, 'TokenUsageTable', {
      partitionKey: {
        name: 'userId',
        type: ddb.AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: ddb.AttributeType.STRING,
      },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
    });

    // Statistics table for each usecase
    const tokenUsageByUsecaseTable = new ddb.Table(
      this,
      'TokenUsageByUsecaseTable',
      {
        partitionKey: {
          name: 'userId',
          type: ddb.AttributeType.STRING,
        },
        sortKey: {
          name: 'dateUsecase', // 'YYYY-MM-DD#usecase' format
          type: ddb.AttributeType.STRING,
        },
        billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      }
    );

    // Statistics table for each model
    const tokenUsageByModelTable = new ddb.Table(
      this,
      'TokenUsageByModelTable',
      {
        partitionKey: {
          name: 'userId',
          type: ddb.AttributeType.STRING,
        },
        sortKey: {
          name: 'dateModel', // 'YYYY-MM-DD#modelId' format
          type: ddb.AttributeType.STRING,
        },
        billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      }
    );

    this.table = table;
    this.tokenUsageTable = tokenUsageTable;
    this.tokenUsageByUsecaseTable = tokenUsageByUsecaseTable;
    this.tokenUsageByModelTable = tokenUsageByModelTable;
    this.feedbackIndexName = feedbackIndexName;
  }
}
