# Technical Stack and Build System

## Core Technologies

- **Frontend**: React with TypeScript, Vite, TailwindCSS
- **Backend**: AWS CDK (Cloud Development Kit) for infrastructure as code
- **AI Services**: Amazon Bedrock, Amazon Kendra, Amazon Transcribe
- **Authentication**: Amazon Cognito with SAML support
- **Storage**: Amazon S3, DynamoDB
- **API**: AWS API Gateway, AWS Lambda

## Key Libraries and Frameworks

### Frontend

- React 18
- TypeScript
- Vite for build tooling
- TailwindCSS for styling
- i18next for internationalization
- SWR for data fetching
- Zustand for state management
- React Router for navigation
- AWS Amplify for AWS service integration

### Backend

- AWS CDK for infrastructure as code
- TypeScript
- AWS Lambda for serverless functions
- AWS SDK for JavaScript

## Project Build Commands

### Root Project Commands

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Run tests
npm run test

# Deploy AWS resources
npm run cdk:deploy

# Fast deployment (without pre-checking)
npm run cdk:deploy:quick

# Delete AWS resources
npm run cdk:destroy

# Documentation development server
npm run docs:dev

# Build documentation
npm run docs:build
```

### Web Frontend Commands

```bash
# Start development server
npm run web:dev

# Build for production
npm run web:build

# Run linting
npm run web:lint

# Run tests
npm run web:test
```

### CDK Commands

```bash
# Bootstrap CDK (first-time setup)
npx -w packages/cdk cdk bootstrap

# Deploy CDK stacks
npm run cdk:deploy

# Run CDK tests
npm run cdk:test
```

### Browser Extension Commands

```bash
# Install extension dependencies
npm run extension:ci

# Start extension development
npm run extension:dev

# Build extension
npm run extension:build
```

## Environment Setup

Before deploying, ensure:

1. AWS CLI is configured with appropriate credentials
2. Node.js and npm are installed
3. Required Bedrock models are enabled in your AWS account
4. CDK is bootstrapped in your AWS environment (first-time only)

## Configuration

The main configuration file is `packages/cdk/cdk.json`, which controls:

- AWS region settings
- Enabled AI models and capabilities
- Security settings
- RAG configuration
- Agent and Flow settings
- UI customization options
