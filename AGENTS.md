# Generative AI Use Cases (GenU)

Instructions for AI coding agents (Kiro, Claude Code and others) working in this repository. Human contributors should read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/en/DEVELOPMENT.md](docs/en/DEVELOPMENT.md); this file follows them.

## What GenU is

GenU is an AWS sample application with business use cases for generative AI: chat, RAG chat (Amazon Kendra or Knowledge Bases for Amazon Bedrock), agents (Bedrock Agents, AgentCore, Agent Builder), Bedrock Flows, text generation, summarization, meeting minutes, writing, translation, web content extraction, image and video generation, video analysis, diagram generation, voice chat, and a no-code Use Case Builder. It runs on Amazon Bedrock and is deployed with AWS CDK. Organizations deploy and customize it, so existing deployments, data and configuration must keep working across updates.

## Repository layout

```
packages/
├── cdk/                    # AWS CDK app (infrastructure) and Lambda code
│   ├── bin/, lib/          # Stacks and constructs; lib/stack-input.ts is the parameter schema
│   ├── lambda/             # TypeScript Lambda: api/ is the Express API behind API Gateway; other files hold
│   │                       #   its handlers or are invoked directly by the client (predictStream.ts and others)
│   ├── lambda-python/      # AgentCore runtimes in Python (generic: Strands Agents, research: Claude Agent SDK)
│   ├── custom-resources/   # Custom resources
│   ├── cdk.json, parameter.ts  # Deployment parameters
│   └── test/               # Jest tests and CloudFormation snapshots
├── web/                    # React + Vite + Tailwind frontend
├── types/                  # Types shared by web and cdk
├── common/                 # Code shared by web and cdk
└── eslint-plugin-i18nhelper/  # Lint rules that keep UI strings in i18n
browser-extension/          # Browser extension
docs/{en,ja,ko}/            # Documentation (MkDocs); README.md, README_ja.md, README_ko.md at the root
```

## Coding rules

Before editing a package, read its coding rules (written in Japanese):

- `packages/cdk/` (infrastructure): [packages/cdk/CODING_RULES.md](packages/cdk/CODING_RULES.md)
- `packages/cdk/lambda/` (API and Lambda): [packages/cdk/lambda/CODING_RULES.md](packages/cdk/lambda/CODING_RULES.md)
- `packages/web/` (frontend): [packages/web/CODING_RULES.md](packages/web/CODING_RULES.md)

Follow the existing code in the same directory when the rules do not cover a case.

## Commands

Run from the repository root.

```bash
npm ci                              # Install dependencies
npm run lint                        # Lint everything (also runs on git commit)
npm run web:test                    # Frontend unit tests
npm run cdk:test                    # CDK unit and snapshot tests
npm run cdk:test:update-snapshot    # Update snapshots after an intended change
npm run web:devw                    # Frontend against a deployed stack (see docs/en/DEVELOPMENT.md)
npm run cdk:diff -- -c env=<env>    # Preview changes to a deployed environment
```

`npm run lint` runs on `git commit` through Husky and lint-staged. Do not skip it with `--no-verify`.

## Rules for changes

- **Existing deployments**: a change must not delete or replace a resource that holds data (DynamoDB tables, S3 buckets, Cognito user pools, Knowledge Bases and similar). `packages/cdk/test/stateful-resources.test.ts` and the "Stateful resource check" workflow fail when it does. Do not update that snapshot to make the check pass; describe the impact instead.
- **Parameters**: a new deployment parameter needs a default in `packages/cdk/lib/stack-input.ts` that keeps the current behavior, and a section in `docs/{en,ja,ko}/DEPLOY_OPTION.md`. Existing deployments that do not set it must synthesize the same resources as before.
- **UI text**: put user-facing strings in `packages/web/public/locales/translation/*.yaml` and use i18n. Do not write Japanese strings or comments in code.
- **Snapshots**: if `npm run cdk:test` shows snapshot differences, check that they are intended, update them, and explain them in the pull request.
- **Documentation**: when behavior or a parameter changes, update `docs/en`, `docs/ja` and `docs/ko` (and the READMEs if they mention it) in the same pull request.
- **Release notes**: maintainers write [docs/en/RELEASE_NOTES.md](docs/en/RELEASE_NOTES.md) and [docs/ja/RELEASE_NOTES.md](docs/ja/RELEASE_NOTES.md) when they prepare a release; pull requests do not need to edit them. When writing them, keep "Highlights" / "主な変更" to changes people notice when they use GenU, because it is also shown in the app. Changes to deployment settings, infrastructure or operations go under "For administrators" / "管理者向け", and impact on existing deployments under "Before you update" / "アップデート前の確認事項". The pull request description should state that impact so it can be carried over.
- **Pull requests**: one topic per pull request, using [.github/pull_request_template.md](.github/pull_request_template.md). State the impact on existing users and how the change was verified.

## Skills

Agent skills for this repository are in [.kiro/skills/](.kiro/skills/) ([Agent Skills](https://agentskills.io) format). `.claude/skills` points to the same directory, so Kiro and Claude Code load the same skills. Add new skills under `.kiro/skills/`.

- `genu-update`: update a deployed GenU to a newer release.
