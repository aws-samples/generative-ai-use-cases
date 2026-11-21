# Release Notes

This page summarizes each GenU release. The full list of changes for each release is on the [Releases page](https://github.com/aws-samples/generative-ai-use-cases/releases).

GenU is deployed and updated from release tags (see [Update Method](./UPDATE.md)). Before updating, read every release between your current version and the new one, especially the **Before you update** sections.

## Upcoming (v5.6.0)

These changes are merged into the `main` branch and will be included in the next release, v5.6.0. They are not in the latest release yet.

### Highlights

- **Admin page for token usage and cost**: members of the new Cognito group `SystemAdminGroup` can see every user's token usage and estimated cost at `/admin`, filter by user and period, and download a CSV. The stats page also shows each user's own cost. Bedrock calls carry usage tags (`genu_user`, `genu_usecase`) that appear in the model invocation logs. (#1827)
- **Closed network mode improvements**: the AgentCore Runtime runs inside the closed VPC, Interface VPC endpoints are created only for the features in use, and settings that do not work in closed network mode are reported as warnings at synth time. (#1814, #1761, #1723)
- **Chat experience**: the model selector moved into the input toolbar, chat history is grouped by date, the selected model and reasoning settings are kept across reloads, Markdown tables can be copied for spreadsheets, and the chat model is told today's date. (#1788, #1781, #1787, #1782, #1786)
- **Knowledge Base**: S3 Vectors as an alternative vector store, and Guardrails for the Knowledge Base chat. (#1471, #1649)
- **Speech**: voice and language selection in Voice Chat, a choice of auto-detect languages for speech recognition in Settings, and Amazon Nova 2.5 Sonic for speech-to-speech. (#1727, #1779, #1726)
- **Agent Builder**: agent definitions can be shared as JSON. (#1689)
- **New models**: Claude Opus 5, Claude Fable 5, Claude Opus 5.5, Claude Sonnet 5.5, Claude Haiku 5.5, OpenAI GPT-6 / GPT-6.1 / GPT-5.6, Moonshot AI Kimi K3 / K3.1. (#1652, #1646, #1707, #1712, #1724, #1709, #1755, #1704, #1795)
- **Update tooling**: the deployment and update guides now use release tags, `deploy.sh` deploys the latest release by default (`--ref` selects another one), and a `genu-update` agent skill helps merge a new release into a customized branch. (#1766, #1777)

### Before you update

- **Knowledge Base Web Crawler data source removed**: Bedrock no longer allows new Web Crawler connectors on customer-managed knowledge bases. Updating deletes the existing `web-crawler-data-source` and the documents it ingested. Documents from the S3 data source are not affected. (#1747)
- **Default image and video models**: Nova Canvas and Nova Reel reached end of life. The default image model is now Stable Image Core (`us-west-2`), and video generation is off by default. To keep video generation, set `videoGenerationModelIds` to `luma.ray-v2:0` in `us-west-2` and bootstrap that region. Deployments that set their own models are not affected. (#1791)
- **Default Knowledge Base advanced parsing model**: the default is now `global.anthropic.claude-sonnet-4-6`, because the previous default reaches end of life. (#1813)
- **Closed network mode**:
  - VPC endpoints of features that are not enabled are deleted. If other workloads in an imported VPC use them, list them in `closedNetworkAdditionalVpcEndpoints` before deploying.
  - The test instance type changes to `t3.large`. Set `closedNetworkTestEnvironmentInstanceType: 'r6i.large'` to keep the previous type.
  - If AgentCore is enabled, its runtime moves into the closed VPC, and `agentCoreRegion` must equal `region`. `researchAgentEnabled` cannot be combined with closed network mode.
  - The API Gateway resource policy changes form, and the API deployment is recreated. Requests from endpoints that are not allowed now get 403 instead of 401. (#1814, #1723)
- **New Cognito group**: `SystemAdminGroup` is created. If the user pool already has a group with this name, the update fails. (#1827)
- **Meeting minutes transcription** starts with automatic language detection (Japanese and English by default) instead of the UI language. The languages can be changed in Settings. (#1779)

### Fixes

- Long chat messages are saved without rolling back the turn, and very large pasted text becomes an attachment. (#1757)
- Bedrock rejection reasons (for example image size limits) are shown to the user. (#1789, #1822)
- Attached files with the same name, Shift_JIS / EUC-JP documents, blank text and file name characters that Bedrock rejects are handled. (#1756, #1805, #1679, #1765, #1801, #1677)
- The app keeps working after the browser's page translation is used. (#1828)
- Agent gallery sync, S3 permissions when no IP ranges are set, and reading long chats. (#1826)

## v5.5.0 (2026-07-19)

### Highlights

- **New models**: Claude Sonnet 5, Claude Opus 4.8, Claude Opus 4.7, Claude Opus 4.6 / Sonnet 4.6.
- **AgentCore**: VPC configuration for the AgentCore Runtime and a list screen for AgentCore.
- **Research use case**.
- **Knowledge Base**: Web Crawler data source, citation improvements and system prompt customization.
- **Meeting minutes**: custom prompts, download of generated minutes, screen sleep prevention during recording.
- **Markdown**: ECharts charts and SVG preview in code blocks.
- **Browser extension**: model switching.
- **Security**: script injection mitigation in the auto deploy workflow, `unsafe-eval` removed from the CSP, dependency CVEs resolved.
- **Internal**: the API Lambda functions were consolidated into one Express application, and Cognito is reached through VPC endpoints in closed network mode.

[Full changelog](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.5.0)

## v5.4.0 (2026-01-13)

### Highlights

- **Agent Builder**: create agents without code, with automatic system prompt generation.
- **Mermaid diagrams and math rendering** in chat.
- **Branding**: custom logo and title.
- **Chat history**: bulk delete.
- **Meeting minutes**: protection against losing a recording.
- **New models**: Claude Opus 4.5, Nemotron 3 Nano 30B and 17 more models, plus a default model setting.
- **AgentCore**: faster MCP loading and AgentCore Gateway support.
- `destroy.sh` for deleting the resources and a `cdk:diff` shortcut.

[Full changelog](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.4.0)

## v5.3.0 (2025-10-27)

### Highlights

- Custom tag keys for cost management.
- Claude Haiku 4.5.
- AgentCore use cases in closed network mode.

[Full changelog](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.3.0)

## v5.2.0 (2025-10-15)

### Highlights

- Claude Sonnet 4.5, with extended thinking and prompt caching.
- Maximum number of agent loops can be set.
- Real-time translation improvements for meeting minutes.
- Deployment in a private network with SageMaker Code Editor.
- End-of-life models removed.

[Full changelog](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.2.0)

## v5.1.0 - v5.1.2 (2025-08-29 - 2025-09-11)

### Highlights

- Reasoning toggle in chat and AgentCore UI improvements.
- Global cross-Region inference.
- Fixes for closed network mode and for files uploaded in agent use cases.

### Before you update

- **SageMaker endpoints** are called with the TGI Messages API, and the application-side prompt templates were removed. Use TGI 1.4.0 or later, with a `chat_template` in the model's `tokenizer_config.json` (v5.1.0).

[v5.1.0](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.0) / [v5.1.1](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.1) / [v5.1.2](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.2)

## v5.0.0 - v5.0.1 (2025-08-26)

### Highlights

- **AgentCore**: agents on Amazon Bedrock AgentCore.
- **Closed network mode**: access GenU only from a VPC.
- **Voice Chat** is generally available.
- OpenAI GPT OSS 20B / 120B.
- Tags for cost management.

### Before you update

- **MCP Chat** is deprecated and will be removed in a future major version.

[v5.0.0](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.0.0) / [v5.0.1](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.0.1)
