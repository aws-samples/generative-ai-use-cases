# Release Notes

<!-- The Highlights section of each release is also shown on the settings page of the app. Write it for the people who use GenU, and only include changes they notice when they use the app. Put changes for administrators (deployment settings, infrastructure, operations) under "For administrators" or "Before you update". -->

This page summarizes each GenU release. The full list of changes for each release is on the [Releases page](https://github.com/aws-samples/generative-ai-use-cases/releases).

GenU is deployed and updated from release tags (see [Update Method](./UPDATE.md)). Before updating, read every release between your current version and the new one, especially the **Before you update** sections.

## Upcoming (v5.6.0)

These changes are merged into the `main` branch and will be included in the next release, v5.6.0. They are not in the latest release yet.

### Highlights

- **Chat**: the model selector moved into the input toolbar, chat history is grouped by date, the selected model and reasoning settings are kept across reloads, Markdown tables can be copied for pasting into spreadsheets, and the chat model knows today's date. (#1788, #1781, #1787, #1782, #1786)
- **Sidebar and settings**: the sidebar can be collapsed to icons and resized, and each user chooses the use cases it shows (favorites). The settings page has General, Usage, Account and System tabs; the Usage tab shows each user's own token usage and cost, and the System tab shows these release notes. (#1830, #1831)
- **Speech**: voice and language selection in Voice Chat, a choice of languages for automatic language detection in speech recognition (Settings), and Amazon Nova 2.5 Sonic for Voice Chat. (#1727, #1779, #1726)
- **Agent Builder**: agent definitions can be shared as JSON files. (#1689)
- **New models** (available when the administrator enables them): Claude Opus 5, Claude Fable 5, Claude Opus 5.5, Claude Sonnet 5.5, Claude Haiku 5.5, Claude Fable 5.1 / 5.2, OpenAI GPT-6 / GPT-6.1 / GPT-6.2 Sol / GPT-6.2 Astra / GPT-5.4 / GPT-5.5 / GPT-5.6, Moonshot AI Kimi K3 / K3.1 / K2.5, Grok 4.6 / 4.7, GLM 5, DeepSeek V3.2, MiniMax M2.5, NVIDIA Nemotron 3 Super 120B, Qwen3 Coder Next, Palmyra Vision 7B. (#1652, #1646, #1707, #1712, #1724, #1709, #1755, #1704, #1795, #1832)

### For administrators

- Knowledge Base: S3 Vectors can be used as a lower-cost vector store, and guardrails also check RAG chat answers. (#1471, #1649)
- An admin page shows every user's token usage and estimated cost, with filters by user and period and a CSV download. Bedrock calls are tagged with the user and the use case, so usage can also be analyzed in the model invocation logs. (#1827)
- Administrators are told in the System tab of the settings page when a newer release is available.
- Closed network mode runs AgentCore inside the closed VPC, creates only the VPC endpoints for the features in use, and warns at deploy time about settings that do not work in a closed network. (#1814, #1761, #1723)
- Deployments warn about models that Bedrock no longer offers or will retire. (#1832)
- The deployment and update guides use release tags, and an agent skill helps merge a new release into a customized deployment. (#1766, #1777)
- A custom domain can be set at the zone apex, without `hostName`. (#1834)

### Before you update

- **Knowledge Base Web Crawler data source removed**: Bedrock no longer allows new Web Crawler connectors on customer-managed knowledge bases. Updating deletes the existing `web-crawler-data-source` and the documents it ingested. Documents from the S3 data source are not affected. (#1747)
- **Default image and video models**: Nova Canvas and Nova Reel reached end of life. The default image model is now Stable Image Core (`us-west-2`), and video generation is off by default. To keep video generation, set `videoGenerationModelIds` to `luma.ray-v2:0` in `us-west-2` and bootstrap that region. Deployments that set their own models are not affected. (#1791)
- **Default text models**: if `modelIds` is not set, `us.deepseek.r1-v1:0` (end of life 2027-03-30) is replaced by `openai.gpt-oss-120b-1:0`. Deployments that set `modelIds` are not affected. (#1832)
- **End-of-life warnings with the default settings**: the default image model `stability.stable-image-core-v1:1` is Legacy (end of life 2027-05-09), so the default settings show one warning at deploy time. Bedrock has no active text-to-image model to switch to yet. (#1832)
- **Model capabilities corrected**: Mistral Large 3 and Ministral 3 accept image attachments, Gemma 3 no longer accepts document attachments, and DeepSeek-R1 no longer shows the reasoning option, to match what Bedrock accepts. (#1832)
- **Default Knowledge Base advanced parsing model**: the default is now `global.anthropic.claude-sonnet-4-6`, because the previous default (Claude 3 Sonnet) reached end of life on 2026-11-13. (#1813)
- **Closed network mode: VPC endpoints**: VPC endpoints of features that are not enabled are deleted. If other workloads in an imported VPC use them, list them in `closedNetworkAdditionalVpcEndpoints` before deploying.
- **Closed network mode: test instance**: the test instance type changes to `t3.large`. Set `closedNetworkTestEnvironmentInstanceType: 'r6i.large'` to keep the previous type.
- **Closed network mode: AgentCore**: if AgentCore is enabled, its runtime moves into the closed VPC, and `agentCoreRegion` must equal `region`. `researchAgentEnabled` cannot be combined with closed network mode.
- **Closed network mode: API Gateway**: the API Gateway resource policy changes form, and the API deployment is recreated. Requests from endpoints that are not allowed now get 403 instead of 401. (#1814, #1723)
- **New Cognito group**: `SystemAdminGroup` is created. If the user pool already has a group with this name, the update fails. (#1827)
- **Settings page**: the list of recent pull requests on the System tab is replaced by the release notes of the deployed version, read from `docs/en/RELEASE_NOTES.md` and `docs/ja/RELEASE_NOTES.md` at build time. The notice of a newer release is shown only to members of `SystemAdminGroup` and compares the full version with the latest release on GitHub.
- **Meeting minutes transcription** starts with automatic language detection (Japanese and English by default) instead of the UI language. The languages can be changed in Settings. (#1779)
- **Custom domain without `hostName`**: if `domainName` and `hostedZoneId` are set and `hostName` is not, the update now creates a certificate and an A record for the zone apex (`domainName` itself). Before, no custom domain was set up. Remove `domainName` and `hostedZoneId` if you do not want this. The update fails if the zone apex already has an A record. (#1834)

### Fixes

- Long chat messages are saved without rolling back the turn, and very large pasted text becomes an attachment. (#1757)
- Bedrock rejection reasons (for example image size limits) are shown to the user. (#1789, #1822)
- Attached files with the same name, Shift_JIS / EUC-JP documents, blank text and file name characters that Bedrock rejects are handled. (#1756, #1805, #1679, #1765, #1801, #1677)
- Ministral 3 and Qwen3 235B work again (their default `maxTokens` was above the model's limit), and models that do not accept a system prompt no longer get an empty one. (#1832)
- Without a configured flow, `/flow-chat` shows the "not found" page. (#1829)
- The app keeps working after the browser's page translation is used. (#1828, #1833)
- Use cases that call `{{retrieveKnowledgeBase}}` work with an S3 Vectors Knowledge Base. (#1837)
- Agent gallery sync, S3 permissions when no IP ranges are set, and reading long chats. (#1826)
- Large images are scaled down to 2,576 px on the longest side when attached, so Bedrock no longer rejects them for their dimensions. Models that accept fewer than 20 images limit the attachment count (1 for Llama 3.2 Vision, 8 for Llama 4). (#1835, #1836)

## v5.5.0 (2026-07-19)

### Highlights

- **New models** (available when the administrator enables them): Claude Sonnet 5, Claude Opus 4.8, Claude Opus 4.7, Claude Opus 4.6 / Sonnet 4.6.
- **AgentCore**: a list screen for AgentCore.
- **Research use case**.
- **RAG chat (Knowledge Base)**: improved citations.
- **Meeting minutes**: custom prompts, download of generated minutes, screen sleep prevention during recording.
- **Markdown**: ECharts charts and SVG preview in code blocks.
- **Browser extension**: model switching.

### For administrators

- VPC configuration for the AgentCore Runtime.
- Knowledge Base: Web Crawler data source and system prompt customization.
- Security: script injection mitigation in the auto deploy workflow, `unsafe-eval` removed from the CSP, dependency CVEs resolved.
- The API Lambda functions were consolidated into one Express application, and Cognito is reached through VPC endpoints in closed network mode.

[Full changelog](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.5.0)

## v5.4.0 (2026-01-13)

### Highlights

- **Agent Builder**: create agents without code, with automatic system prompt generation.
- **Mermaid diagrams and math rendering** in chat.
- **Chat history**: bulk delete.
- **Meeting minutes**: a warning before leaving the page during a recording.
- **New models** (available when the administrator enables them): Claude Opus 4.5, Nemotron 3 Nano 30B and 17 more models.

### For administrators

- Branding: custom logo and title.
- A default model setting.
- AgentCore: faster MCP loading and AgentCore Gateway support.
- `destroy.sh` for deleting the resources and a `cdk:diff` shortcut.

[Full changelog](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.4.0)

## v5.3.0 (2025-10-27)

### Highlights

- **New models** (available when the administrator enables them): Claude Haiku 4.5.

### For administrators

- Custom tag keys for cost management.
- AgentCore use cases in closed network mode.

[Full changelog](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.3.0)

## v5.2.0 (2025-10-15)

### Highlights

- **New models** (available when the administrator enables them): Claude Sonnet 4.5, with extended thinking.
- **Meeting minutes**: real-time translation improvements.

### For administrators

- Prompt caching for Claude Sonnet 4.5.
- Maximum number of agent loops can be set.
- Deploying from SageMaker Code Editor with the private network options.
- End-of-life models removed.

[Full changelog](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.2.0)

## v5.1.0 - v5.1.2 (2025-08-29 - 2025-09-11)

### Highlights

- **Chat**: a reasoning toggle.
- **AgentCore**: UI improvements, and uploaded files no longer disappear in agent use cases.

### For administrators

- Global cross-Region inference.
- Fixes for closed network mode.

### Before you update

- **SageMaker endpoints** are called with the TGI Messages API, and the application-side prompt templates were removed. Use TGI 1.4.0 or later, with a `chat_template` in the model's `tokenizer_config.json` (v5.1.0).

[v5.1.0](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.0) / [v5.1.1](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.1) / [v5.1.2](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.1.2)

## v5.0.0 - v5.0.1 (2025-08-26)

### Highlights

- **AgentCore**: a use case for agents on Amazon Bedrock AgentCore.
- **Voice Chat** is generally available.
- **New models** (available when the administrator enables them): OpenAI GPT OSS 20B / 120B.

### For administrators

- Closed network mode: access GenU only from a VPC.
- Tags for cost management.

### Before you update

- **MCP Chat** is deprecated and will be removed in a future major version.

[v5.0.0](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.0.0) / [v5.0.1](https://github.com/aws-samples/generative-ai-use-cases/releases/tag/v5.0.1)
