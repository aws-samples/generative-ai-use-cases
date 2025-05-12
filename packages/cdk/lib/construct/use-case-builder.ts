import {
  RestApi,
  LambdaIntegration,
  CognitoUserPoolsAuthorizer,
  AuthorizationType,
} from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import {
  NodejsFunction,
  NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';

export interface UseCaseBuilderProps {
  readonly userPool: UserPool;
  readonly api: RestApi;
}
export class UseCaseBuilder extends Construct {
  constructor(scope: Construct, id: string, props: UseCaseBuilderProps) {
    super(scope, id);

    const { userPool, api } = props;

    const useCaseIdIndexName = 'UseCaseIdIndexName';
    const useCaseBuilderTable = new ddb.Table(this, 'UseCaseBuilderTable', {
      partitionKey: {
        name: 'id',
        type: ddb.AttributeType.STRING,
      },
      sortKey: {
        name: 'dataType',
        type: ddb.AttributeType.STRING,
      },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
    });

    useCaseBuilderTable.addGlobalSecondaryIndex({
      indexName: useCaseIdIndexName,
      partitionKey: {
        name: 'useCaseId',
        type: ddb.AttributeType.STRING,
      },
      sortKey: {
        name: 'dataType',
        type: ddb.AttributeType.STRING,
      },
      projectionType: ddb.ProjectionType.ALL,
    });

    const commonProperty: NodejsFunctionProps = {
      runtime: Runtime.NODEJS_LATEST,
      timeout: Duration.minutes(15),
      environment: {
        USECASE_TABLE_NAME: useCaseBuilderTable.tableName,
        USECASE_ID_INDEX_NAME: useCaseIdIndexName,
      },
    };

    const commonPath = './lambda/useCaseBuilder';

    // Add UseCaseBuilder related APIs
    const listUseCasesFunction = new NodejsFunction(this, 'ListUseCases', {
      ...commonProperty,
      memorySize: 512,
      entry: `${commonPath}/listUseCases.ts`,
    });
    useCaseBuilderTable.grantReadData(listUseCasesFunction);

    const listFavoriteUseCasesFunction = new NodejsFunction(
      this,
      'ListFavoriteUseCases',
      {
        ...commonProperty,
        memorySize: 512,
        entry: `${commonPath}/listFavoriteUseCases.ts`,
        environment: {
          ...commonProperty.environment,
          USECASE_ID_INDEX_NAME: useCaseIdIndexName,
        },
      }
    );
    useCaseBuilderTable.grantReadData(listFavoriteUseCasesFunction);

    const getUseCaseFunction = new NodejsFunction(this, 'GetUseCase', {
      ...commonProperty,
      memorySize: 512,
      entry: `${commonPath}/getUseCase.ts`,
    });
    useCaseBuilderTable.grantReadData(getUseCaseFunction);

    const createUseCaseFunction = new NodejsFunction(this, 'CreateUseCase', {
      ...commonProperty,
      entry: `${commonPath}/createUseCase.ts`,
    });
    useCaseBuilderTable.grantWriteData(createUseCaseFunction);

    const updateUseCaseFunction = new NodejsFunction(this, 'UpdateUseCase', {
      ...commonProperty,
      entry: `${commonPath}/updateUseCase.ts`,
    });
    useCaseBuilderTable.grantReadWriteData(updateUseCaseFunction);

    const deleteUseCaseFunction = new NodejsFunction(this, 'DeleteUseCase', {
      ...commonProperty,
      entry: `${commonPath}/deleteUseCase.ts`,
    });
    useCaseBuilderTable.grantReadWriteData(deleteUseCaseFunction);

    const toggleFavoriteFunction = new NodejsFunction(this, 'ToggleFavorite', {
      ...commonProperty,
      entry: `${commonPath}/toggleFavorite.ts`,
    });
    useCaseBuilderTable.grantReadWriteData(toggleFavoriteFunction);

    const toggleSharedFunction = new NodejsFunction(this, 'ToggleShared', {
      ...commonProperty,
      entry: `${commonPath}/toggleShared.ts`,
    });
    useCaseBuilderTable.grantReadWriteData(toggleSharedFunction);

    const listRecentlyUsedUseCasesFunction = new NodejsFunction(
      this,
      'ListRecentlyUsedUseCases',
      {
        ...commonProperty,
        memorySize: 512,
        entry: `${commonPath}/listRecentlyUsedUseCases.ts`,
      }
    );
    useCaseBuilderTable.grantReadData(listRecentlyUsedUseCasesFunction);

    const updateRecentlyUsedUseCaseFunction = new NodejsFunction(
      this,
      'UpdateRecentlyUsedUseCase',
      {
        ...commonProperty,
        entry: `${commonPath}/updateRecentlyUsedUseCase.ts`,
      }
    );
    useCaseBuilderTable.grantReadWriteData(updateRecentlyUsedUseCaseFunction);

    // API Gateway
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
    });

    const commonAuthorizerProps = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer,
    };
    const useCasesResource = api.root.addResource('usecases');

    // GET: /usecases
    useCasesResource.addMethod(
      'GET',
      new LambdaIntegration(listUseCasesFunction),
      commonAuthorizerProps
    );

    // POST: /usecases
    useCasesResource.addMethod(
      'POST',
      new LambdaIntegration(createUseCaseFunction),
      commonAuthorizerProps
    );

    const favoriteUseCaseResource = useCasesResource.addResource('favorite');

    // GET: /usecases/favorite
    favoriteUseCaseResource.addMethod(
      'GET',
      new LambdaIntegration(listFavoriteUseCasesFunction),
      commonAuthorizerProps
    );

    const useCaseResource = useCasesResource.addResource('{useCaseId}');

    // GET: /usecases/{useCaseId}
    useCaseResource.addMethod(
      'GET',
      new LambdaIntegration(getUseCaseFunction),
      commonAuthorizerProps
    );

    // PUT: /usecases/{useCaseId}
    useCaseResource.addMethod(
      'PUT',
      new LambdaIntegration(updateUseCaseFunction),
      commonAuthorizerProps
    );

    // DELETE: /usecases/{useCaseId}
    useCaseResource.addMethod(
      'DELETE',
      new LambdaIntegration(deleteUseCaseFunction),
      commonAuthorizerProps
    );

    const favoriteResource = useCaseResource.addResource('favorite');

    // PUT: /usecases/{useCaseId}/favorite
    favoriteResource.addMethod(
      'PUT',
      new LambdaIntegration(toggleFavoriteFunction),
      commonAuthorizerProps
    );

    const sharedResource = useCaseResource.addResource('shared');

    // PUT: /usecases/{useCaseId}/shared
    sharedResource.addMethod(
      'PUT',
      new LambdaIntegration(toggleSharedFunction),
      commonAuthorizerProps
    );

    const recentUseCasesResource = useCasesResource.addResource('recent');

    // GET: /usecases/recent
    recentUseCasesResource.addMethod(
      'GET',
      new LambdaIntegration(listRecentlyUsedUseCasesFunction),
      commonAuthorizerProps
    );

    const recentUseCaseResource =
      recentUseCasesResource.addResource('{useCaseId}');

    // PUT: /usecases/recent/{useCaseId}
    recentUseCaseResource.addMethod(
      'PUT',
      new LambdaIntegration(updateRecentlyUsedUseCaseFunction),
      commonAuthorizerProps
    );
  }
}
