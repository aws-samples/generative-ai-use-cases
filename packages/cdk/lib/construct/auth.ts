import { Duration } from 'aws-cdk-lib';
import {
  UserPool,
  UserPoolClient,
  UserPoolOperation,
  StringAttribute,
} from 'aws-cdk-lib/aws-cognito';
import {
  IdentityPool,
  UserPoolAuthenticationProvider,
} from 'aws-cdk-lib/aws-cognito-identitypool';
import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LAMBDA_RUNTIME_NODEJS } from '../../consts';

export interface AuthProps {
  readonly selfSignUpEnabled: boolean;
  readonly allowedIpV4AddressRanges?: string[] | null;
  readonly allowedIpV6AddressRanges?: string[] | null;
  readonly allowedSignUpEmailDomains?: string[] | null;
  readonly samlAuthEnabled: boolean;
}

export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly client: UserPoolClient;
  readonly idPool: IdentityPool;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    const userPool = new UserPool(this, 'UserPool', {
      // If SAML authentication is enabled, do not use self-sign-up with UserPool. Be aware of security.
      selfSignUpEnabled: props.samlAuthEnabled
        ? false
        : props.selfSignUpEnabled,
      signInAliases: {
        username: false,
        email: true,
      },
      passwordPolicy: {
        requireUppercase: true,
        requireSymbols: true,
        requireDigits: true,
        minLength: 8,
      },
      customAttributes: {
        tenantId: new StringAttribute({
          minLen: 1,
          maxLen: 256,
          mutable: false,
        }),
      },
    });

    const client = userPool.addClient('client', {
      idTokenValidity: Duration.days(1),
      readAttributes: {
        address: true,
        birthdate: true,
        email: true,
        emailVerified: true,
        familyName: true,
        gender: true,
        givenName: true,
        locale: true,
        middleName: true,
        name: true,
        nickname: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        picture: true,
        preferredUsername: true,
        profile: true,
        updatedAt: true,
        website: true,
        zoneinfo: true,
        'custom:tenantId': true,
      },
    });

    const idPool = new IdentityPool(this, 'IdentityPool', {
      authenticationProviders: {
        userPools: [
          new UserPoolAuthenticationProvider({
            userPool,
            userPoolClient: client,
          }),
        ],
      },
    });

    if (props.allowedIpV4AddressRanges || props.allowedIpV6AddressRanges) {
      const ipRanges = [
        ...(props.allowedIpV4AddressRanges
          ? props.allowedIpV4AddressRanges
          : []),
        ...(props.allowedIpV6AddressRanges
          ? props.allowedIpV6AddressRanges
          : []),
      ];

      idPool.authenticatedRole.attachInlinePolicy(
        new Policy(this, 'SourceIpPolicy', {
          statements: [
            new PolicyStatement({
              effect: Effect.DENY,
              resources: ['*'],
              actions: ['*'],
              conditions: {
                NotIpAddress: {
                  'aws:SourceIp': ipRanges,
                },
              },
            }),
          ],
        })
      );
    }

    idPool.authenticatedRole.attachInlinePolicy(
      new Policy(this, 'PollyPolicy', {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            resources: ['*'],
            actions: ['polly:SynthesizeSpeech'],
          }),
        ],
      })
    );

    // Lambda
    if (props.allowedSignUpEmailDomains) {
      const checkEmailDomainFunction = new NodejsFunction(
        this,
        'CheckEmailDomain',
        {
          runtime: LAMBDA_RUNTIME_NODEJS,
          entry: './lambda/checkEmailDomain.ts',
          timeout: Duration.minutes(15),
          environment: {
            ALLOWED_SIGN_UP_EMAIL_DOMAINS_STR: JSON.stringify(
              props.allowedSignUpEmailDomains
            ),
          },
        }
      );

      userPool.addTrigger(
        UserPoolOperation.PRE_SIGN_UP,
        checkEmailDomainFunction
      );
    }

    this.client = client;
    this.userPool = userPool;
    this.idPool = idPool;
  }
}
