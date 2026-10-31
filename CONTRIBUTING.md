# Contributing Guidelines

Thank you for your interest in contributing to our project. Whether it's a bug report, new feature, correction, or additional
documentation, we greatly value feedback and contributions from our community.

Please read through this document before submitting any issues or pull requests to ensure we have all the necessary
information to effectively respond to your bug report or contribution.

## Reporting Bugs/Feature Requests

We welcome you to use the GitHub issue tracker to report bugs or suggest features.

When filing an issue, please check existing open, or recently closed, issues to make sure somebody else hasn't already
reported the issue. Please try to include as much information as you can. Details like these are incredibly useful:

- A reproducible test case or series of steps
- The version of our code being used
- Any modifications you've made relevant to the bug
- Anything unusual about your environment or deployment

## Contributing via Pull Requests

Contributions via pull requests are much appreciated. Before sending us a pull request, please ensure that:

1. You are working against the latest source on the _main_ branch.
2. You check existing open, and recently merged, pull requests to make sure someone else hasn't addressed the problem already.
3. You open an issue to discuss any significant work - we would hate for your time to be wasted.

To send us a pull request, please:

1. Fork the repository.
2. Modify the source; please focus on the specific change you are contributing. If you also reformat all the code, it will be hard for us to focus on your change.
3. Ensure local tests pass.
4. Commit to your fork using clear commit messages.
5. Send us a pull request, answering any default questions in the pull request interface.
6. Pay attention to any automated CI failures reported in the pull request, and stay involved in the conversation.

For detailed development guidelines including linting and code style requirements, please refer to:

- [DEVELOPMENT.md (English)](docs/en/DEVELOPMENT.md)
- [DEVELOPMENT.md (日本語)](docs/ja/DEVELOPMENT.md)

## Checks on pull requests

Every pull request runs the CI checks (lint, type check, unit tests and the CDK snapshot test). Please make sure they pass before you ask for a review.

The **CDK destructive-change check** (`cdk-destructive-guard.yml`) compares the `cdk synth` output of your branch with its base, using the default parameters. It fails when a stateful resource (DynamoDB, S3, Cognito, KMS, Knowledge Base, ...) would be replaced, deleted or orphaned, because that change would affect data in existing deployments. If the change is intended:

- Describe the impact on existing deployments and the migration steps in the pull request.
- A maintainer reviews them and marks the change as accepted. You do not need to do anything else.

For a change that touches authentication, permissions or data access, please explain in the pull request what the change allows that was not allowed before.

## Coding Standards

When contributing code, please follow the coding standards for each package:

- **CDK Infrastructure**: [packages/cdk/CODING_RULES.md](packages/cdk/CODING_RULES.md)
- **Backend API (Lambda)**: [packages/cdk/lambda/CODING_RULES.md](packages/cdk/lambda/CODING_RULES.md)
- **Frontend (React)**: [packages/web/CODING_RULES.md](packages/web/CODING_RULES.md)

These coding standards ensure consistency, maintainability, and quality across the codebase. Please review the relevant coding rules before making changes to ensure your contributions align with the project's standards.

GitHub provides additional document on [forking a repository](https://help.github.com/articles/fork-a-repo/) and
[creating a pull request](https://help.github.com/articles/creating-a-pull-request/).

## Finding contributions to work on

Looking at the existing issues is a great way to find something to contribute on. As our projects, by default, use the default GitHub issue labels (enhancement/bug/duplicate/help wanted/invalid/question/wontfix), looking at any 'help wanted' issues is a great place to start.

## Code of Conduct

This project has adopted the [Amazon Open Source Code of Conduct](https://aws.github.io/code-of-conduct).
For more information see the [Code of Conduct FAQ](https://aws.github.io/code-of-conduct-faq) or contact
opensource-codeofconduct@amazon.com with any additional questions or comments.

## Security issue notifications

If you discover a potential security issue in this project we ask that you notify AWS/Amazon Security via our [vulnerability reporting page](http://aws.amazon.com/security/vulnerability-reporting/). Please do **not** create a public github issue.

## Licensing

See the [LICENSE](LICENSE) file for our project's licensing. We will ask you to confirm the licensing of your contribution.
