# Project Structure

## Root Organization

The project follows a monorepo structure with workspaces:

```
generative-ai-use-cases/
├── docs/                 # Documentation files (English and Japanese)
├── packages/             # Main code packages
│   ├── cdk/              # AWS CDK infrastructure code
│   ├── common/           # Shared utilities and types
│   ├── types/            # TypeScript type definitions
│   └── web/              # Frontend web application
├── browser-extension/    # Browser extension code
└── .husky/               # Git hooks
```

## Key Packages

### packages/cdk

Contains all AWS infrastructure code defined using CDK:

```
packages/cdk/
├── bin/                  # CDK app entry point
├── lib/                  # CDK constructs and stacks
│   ├── construct/        # Reusable CDK constructs
│   └── utils/            # Helper utilities
├── lambda/               # Lambda function code
├── lambda-python/        # Python Lambda functions
├── custom-resources/     # Custom CDK resources
│   ├── agent-core-runtime/
│   └── opensearch-index/
├── assets/               # Static assets for deployment
└── cdk.json              # CDK configuration
```

### packages/web

Contains the React frontend application:

```
packages/web/
├── public/               # Static assets
├── src/
│   ├── components/       # Reusable UI components
│   ├── hooks/            # React hooks
│   ├── pages/            # Page components
│   ├── utils/            # Utility functions
│   ├── i18n/             # Internationalization
│   └── prompts/          # AI prompt templates
└── vite.config.ts        # Vite configuration
```

### packages/types

Contains TypeScript type definitions shared across packages:

```
packages/types/src/
├── agent.d.ts            # Agent-related types
├── chat.d.ts             # Chat-related types
├── message.d.ts          # Message-related types
├── agent-core.d.ts       # Agent Core types
└── ...                   # Other type definitions
```

## Documentation

Documentation is available in both English and Japanese:

```
docs/
├── en/                   # English documentation
├── ja/                   # Japanese documentation
└── assets/               # Documentation assets and images
```

## Browser Extension

A browser extension is available for accessing GenU functionality:

```
browser-extension/
├── src/                  # Extension source code
├── public/               # Static assets
└── tools/                # Build tools
```

## Code Conventions

1. **TypeScript**: The project uses TypeScript throughout for type safety
2. **React Components**: Functional components with hooks
3. **CDK Constructs**: Modular CDK constructs for infrastructure components
4. **Internationalization**: All user-facing text uses i18n for translation
5. **Testing**: Jest for unit tests

## Configuration Files

- `package.json`: Root package with workspace definitions and scripts
- `packages/cdk/cdk.json`: Main configuration for AWS deployment
- `packages/web/vite.config.ts`: Frontend build configuration
- `mkdocs.yml`: Documentation site configuration
