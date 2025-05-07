<div markdown="1" align="center">
  <h1>Generative AI Use Cases (GenU)</h1>

[![](https://img.shields.io/badge/Documentation-Latest-blue)](https://aws-samples.github.io/generative-ai-use-cases/index.html) [![](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/aws-samples/generative-ai-use-cases/blob/main/LICENSE) [![](https://github.com/aws-samples/generative-ai-use-cases/actions/workflows/node.js.yml/badge.svg)](https://github.com/aws-samples/generative-ai-use-cases/actions/workflows/node.js.yml) [![](https://github.com/aws-samples/generative-ai-use-cases/actions/workflows/browser-extension.yml/badge.svg)](https://github.com/aws-samples/generative-ai-use-cases/actions/workflows/browser-extension.yml)

English | [日本語](./README_ja.md)

Application implementation with business use cases for safely utilizing generative AI in business operations

  <img src="./docs/assets/images/sc_lp_en.png" alt="Application implementation with business use cases for safely utilizing generative AI in business operations" width="68%">
</div>

> [!IMPORTANT]
> GenU has supported multiple languages since v4.
>
> GenU は v4 から多言語対応しました。日本語ドキュメントは[こちら](./README_ja.md)

## GenU Usage Patterns

Here we introduce GenU's features and options by usage pattern. For comprehensive deployment options, please refer to [this document](docs/en/DEPLOY_OPTION.md).

> [!TIP]
> Click on a usage pattern to see details

<details markdown="1">
  <summary><strong><ins>I want to experience generative AI use cases</ins></strong></summary>

GenU provides a variety of standard use cases leveraging generative AI. These use cases can serve as seeds for ideas on how to utilize generative AI in business operations, or they can be directly applied to business as-is. We plan to continuously add more refined use cases in the future. If unnecessary, you can also [hide specific use cases](docs/en/DEPLOY_OPTION.md#hiding-specific-use-cases) with an option. Here are the use cases provided by default.

  <br/>
  <br/>
  <table width="100%">
    <thead>
      <tr>
        <td width="20%">Use Case</td>
        <td width="80%">Description</td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Chat</td>
        <td>You can interact with large language models (LLMs) in a chat format. The existence of platforms that allow direct dialogue with LLMs enables quick responses to specific and new use cases. It's also effective as a testing environment for prompt engineering.</td>
      </tr>
      <tr>
        <td>Text Generation</td>
        <td>Generating text in any context is one of the tasks LLMs excel at. It generates all kinds of text including articles, reports, and emails.</td>
      </tr>
      <tr>
        <td>Summarization</td>
        <td>LLMs are good at summarizing large amounts of text. Beyond simple summarization, they can also extract necessary information in a conversational format after being given text as context. For example, after reading a contract, you can ask questions like "What are the conditions for XXX?" or "What is the amount for YYY?"</td>
      </tr>
      <tr>
        <td>Writing</td>
        <td>LLMs can suggest improvements from a more objective perspective, considering not only typos but also the flow and content of the text. You can expect to improve quality by having the LLM objectively check points you might have missed before showing your work to others.</td>
      </tr>
      <tr>
        <td>Translation</td>
        <td>LLMs trained in multiple languages can perform translations. Beyond simple translation, they can incorporate various specified contextual information such as casualness and target audience into the translation.</td>
      </tr>
      <tr>
        <td>Web Content Extraction</td>
        <td>Extracts necessary information from web content such as blogs and documents. The LLM removes unnecessary information and formats it into well-structured text. Extracted content can be used in other use cases such as summarization and translation.</td>
      </tr>
      <tr>
        <td>Image Generation</td>
        <td>Image generation AI can create new images based on text or existing images. It allows for immediate visualization of ideas, potentially improving efficiency in design work. In this feature, LLMs can assist in creating prompts.</td>
      </tr>
      <tr>
        <td>Video Generation</td>
        <td>Video generation AI creates short videos from text. The generated videos can be used as materials in various scenarios.</td>
      </tr>
      <tr>
        <td>Video Analysis</td>
        <td>With multimodal models, it's now possible to input not only text but also images. In this feature, you can ask the LLM to analyze video frames and text inputs.</td>
      </tr>
      <tr>
        <td>Diagram Generation</td>
        <td>Diagram generation visualizes text and content on any topic using optimal diagrams. It allows for easy text-based diagram creation, enabling efficient creation of flowcharts and other diagrams even for non-programmers and non-designers.</td>
      </tr>
      <tr>
        <td>Voice Chat</td>
        <td>In Voice Chat, you can have a bidirectional voice chat with generative AI. Similar to natural conversation, you can also interrupt and speak while the AI is talking. Also, by setting a system prompt, you can have voice conversations with AI that has specific roles.</td>
      </tr>
    </tbody>
  </table>
</details>

<details markdown="1">
  <summary><strong><ins>I want to do RAG</ins></strong></summary>

RAG is a technique that allows LLMs to answer questions they normally couldn't by providing external up-to-date information or domain knowledge that LLMs typically struggle with.
PDF, Word, Excel, and other files accumulated within your organization can serve as information sources.
RAG also has the effect of preventing LLMs from providing "plausible but incorrect information" by only allowing answers based on evidence.

GenU provides a RAG Chat use case.
Two types of information sources are available for RAG Chat: [Amazon Kendra](docs/en/DEPLOY_OPTION.md) and [Knowledge Base](docs/en/DEPLOY_OPTION.md#enabling-rag-chat-knowledge-base-use-case).
When using Amazon Kendra, you can [use manually created S3 Buckets or Kendra Indexes as they are](docs/en/DEPLOY_OPTION.md#using-an-existing-amazon-kendra-index).
When using Knowledge Base, advanced RAG features such as [Advanced Parsing](docs/en/DEPLOY_OPTION.md#enabling-advanced-parsing), [Chunk Strategy Selection](docs/en/DEPLOY_OPTION.md#changing-chunking-strategy), [Query Decomposition](docs/en/DEPLOY_OPTION.md#enabling-rag-chat-knowledge-base-use-case), and [Reranking](docs/en/DEPLOY_OPTION.md#enabling-rag-chat-knowledge-base-use-case) are available.
Knowledge Base also allows for [Metadata Filter Settings](docs/en/DEPLOY_OPTION.md#metadata-filter-configuration).
For example, you can meet requirements such as "switching accessible data sources by organization" or "allowing users to set filters from the UI."

</details>

<details markdown="1">
  <summary><strong><ins>I want to use custom AI agents or Bedrock Flows within my organization</ins></strong></summary>

When you [enable agents](docs/en/DEPLOY_OPTION.md#enabling-agent-chat-use-case) in GenU, Web Search Agent and Code Interpreter Agent are created.
The Web Search Agent searches the web for information to answer user questions. For example, it can answer "What is AWS GenU?"
The Code Interpreter Agent can execute code to respond to user requests. For example, it can respond to requests like "Draw a scatter plot with some dummy data."

While Web Search Agent and Code Interpreter Agent are basic agents, you might want to use more practical agents tailored to your business needs.
GenU provides a feature to [import agents](docs/en/DEPLOY_OPTION.md#adding-manually-created-agents) that you've created manually or with other assets.

By using GenU as a platform for agent utilization, you can leverage GenU's [rich security options](docs/en/DEPLOY_OPTION.md#security-related-settings) and [SAML authentication](docs/en/DEPLOY_OPTION.md#saml-authentication) to spread practical agents within your organization.
Additionally, you can [hide unnecessary standard use cases](docs/en/DEPLOY_OPTION.md#hiding-specific-use-cases) or [display agents inline](docs/en/DEPLOY_OPTION.md#displaying-agents-inline) to use GenU as a more agent-focused platform.

Similarly, there is an [import feature](docs/en/DEPLOY_OPTION.md#enabling-flow-chat-use-case) for Bedrock Flows, so please make use of it.

</details>

<details markdown="1">
  <summary><strong><ins>I want to create custom use cases</ins></strong></summary>

GenU provides a feature called "Use Case Builder" that allows you to create custom use cases by describing prompt templates in natural language.
Custom use case screens are automatically generated just from prompt templates, so no code changes to GenU itself are required.
Created use cases can be shared with all users who can log into the application, not just for personal use.
Use Case Builder can be [disabled](docs/en/DEPLOY_OPTION.md#use-case-builder-configuration) if not needed.
For more details about Use Case Builder, please check <a href="https://aws.amazon.com/jp/blogs/news/genu-use-cases-builder/">this blog</a>.
<br/>
<br/>
While Use Case Builder can create use cases where you input text into forms or attach files, depending on your requirements, a chat UI might be more suitable.
In such cases, please utilize the system prompt saving feature of the "Chat" use case.
By saving system prompts, you can create business-necessary "bots" with just one click.
For example, you can create "a bot that thoroughly reviews source code when input" or "a bot that extracts email addresses from input content."
Additionally, chat conversation histories can be shared with logged-in users, and system prompts can be imported from shared conversation histories.
<br/>
<br/>
Since GenU is OSS, you can also customize it to add your own use cases.
In that case, please be careful about conflicts with GenU's main branch.

</details>

## Deployment

> [!IMPORTANT]
> Please enable the `modelIds` (text generation), `imageGenerationModelIds` (image generation), and `videoGenerationModelIds` (video generation) in the `modelRegion` region listed in [`/packages/cdk/cdk.json`](/packages/cdk/cdk.json). ([Amazon Bedrock Model access screen](https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess))

GenU deployment uses [AWS Cloud Development Kit](https://aws.amazon.com/jp/cdk/) (CDK). If you cannot prepare a CDK execution environment, refer to the following deployment methods:

- [Deployment method using AWS CloudShell (if preparing your own environment is difficult)](docs/en/DEPLOY_ON_CLOUDSHELL.md)
- Workshop ([English](https://catalog.workshops.aws/generative-ai-use-cases) / [Japanese](https://catalog.workshops.aws/generative-ai-use-cases-jp))

First, run the following command. All commands should be executed at the repository root.

```bash
npm ci
```

If you've never used CDK before, you need to [Bootstrap](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/bootstrapping.html) for the first time only. The following command is unnecessary if your environment is already bootstrapped.

```bash
npx -w packages/cdk cdk bootstrap
```

Next, deploy AWS resources with the following command. Please wait for the deployment to complete (it may take about 20 minutes).

```bash
# Normal deployment
npm run cdk:deploy

# Fast deployment (quickly deploy without pre-checking created resources)
npm run cdk:deploy:quick
```

## Architecture

![arch.drawio.png](./docs/assets/images/arch.drawio.png)

## Other Information

- [Deployment Options](docs/en/DEPLOY_OPTION.md)
- [Update Method](docs/en/UPDATE.md)
- [Local Development Environment Setup](docs/en/DEVELOPMENT.md)
- [Resource Deletion Method](docs/en/DESTROY.md)
- [How to Use as a Native App](docs/en/PWA.md)
- [Using Browser Extensions](docs/en/EXTENSION.md)

## Cost Estimation

We have published configuration and cost estimation examples for using GenU. (The service is pay-as-you-go, and actual costs will vary depending on your usage.)

- [Simple Version (without RAG) Estimation](https://aws.amazon.com/jp/cdp/ai-chatbot/)
- [With RAG (Amazon Kendra) Estimation](https://aws.amazon.com/jp/cdp/ai-chatapp/)
- [With RAG (Knowledge Base) Estimation](https://aws.amazon.com/jp/cdp/genai-chat-app/)

## Customer Case Studies

| Customer                                                                                                                          | Quote                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a href="https://www.yasashiite.com/" target="_blank"><img src="./docs/assets/images/cases/yasashiite_logo.png"></a>              | **Yasashiite Co., Ltd.** <br/> _Thanks to GenU, we were able to provide added value to users and improve employee work efficiency. We continue to evolve from "smooth operation" to "exciting work" as employees' "previous work" transforms into enjoyable work!_ <br/> ・[See case details](./docs/assets/images/cases/yasashiite_case.png) <br/> ・[See case page](https://aws.amazon.com/jp/solutions/case-studies/yasashii-te/)                                |
| <a href="https://www.takihyo.co.jp/" target="_blank"><img src="./docs/assets/images/cases/TAKIHYO_logo.png"></a>                  | **TAKIHYO Co., Ltd.** <br/> _Achieved internal business efficiency and reduced over 450 hours of work by utilizing generative AI. Applied Amazon Bedrock to clothing design, etc., and promoted digital talent development._ <br/> ・[See case page](https://aws.amazon.com/jp/solutions/case-studies/takihyo/)                                                                                                                                                     |
| <a href="https://salsonido.com/" target="_blank"><img src="./docs/assets/images/cases/salsonido_logo.png"></a>                    | **Salsonido Inc.** <br/> _By utilizing GenU, which is provided as a solution, we were able to quickly start improving business processes with generative AI._ <br/> ・[See case details](./docs/assets/images/cases/salsonido_case.png) <br/> ・[Applied service](https://kirei.ai/)                                                                                                                                                                                |
| <a href="https://www.tamura-ss.co.jp/jp/index.html" target="_blank"><img src="./docs/assets/images/cases/tamura-ss_logo.png"></a> | **TAMURA CORPORATION** <br/> _The application samples that AWS publishes on Github have a wealth of immediately testable functions, and by using them as they are, we were able to easily select functions that suited us and shorten the development time of the final system._<br/> ・[See case details](./docs/assets/images/cases/tamura-ss_case.png)<br/>                                                                                                      |
| <a href="https://jdsc.ai/" target="_blank"><img src="./docs/assets/images/cases/jdsc_logo.png"></a>                               | **JDSC Inc.** <br/> _Amazon Bedrock allows us to securely use LLMs with our data. Also, we can switch to the optimal model depending on the purpose, allowing us to improve speed and accuracy while keeping costs down._ <br/> ・[See case details](./docs/assets/images/cases/jdsc_case.png)                                                                                                                                                                      |
| <a href="https://www.iret.co.jp/" target="_blank"><img src="./docs/assets/images/cases/iret_logo.png"></a>                        | **iret, Inc.** <br/> _To accumulate and systematize internal knowledge for BANDAI NAMCO Amusement Inc.'s generative AI utilization, we developed a use case site using Generative AI Use Cases JP provided by AWS. iret, Inc. supported the design, construction, and development of this project._ <br/> ・[BANDAI NAMCO Amusement Inc.'s cloud utilization case study](https://cloudpack.jp/casestudy/302.html?_gl=1*17hkazh*_gcl_au*ODA5MDk3NzI0LjE3MTM0MTQ2MDU) |
| <a href="https://idealog.co.jp" target="_blank"><img src="./docs/assets/images/cases/idealog_logo.jpg"></a>                       | **IDEALOG Inc.** <br/> _I feel that we can achieve even greater work efficiency than with conventional generative AI tools. Using Amazon Bedrock, which doesn't use input/output data for model training, gives us peace of mind regarding security._ <br/> ・[See case details](./docs/assets/images/cases/idealog_case.png) <br/> ・[Applied service](https://kaijosearch.com/)                                                                                   |
| <a href="https://estyle.co.jp/" target="_blank"><img src="./docs/assets/images/cases/estyle_logo.png"></a>                        | **eStyle Inc.** <br/> _By utilizing GenU, we were able to build a generative AI environment in a short period and promote knowledge sharing within the company._ <br/> ・[See case details](./docs/assets/images/cases/estyle_case.png)                                                                                                                                                                                                                             |
| <a href="https://meidensha.co.jp/" target="_blank"><img src="./docs/assets/images/cases/meidensha_logo.svg"></a>                  | **Meidensha Corporation** <br/> _By using AWS services such as Amazon Bedrock and Amazon Kendra, we were able to quickly and securely build a generative AI usage environment. It contributes to employee work efficiency through automatic generation of meeting minutes and searching internal information._ <br/> ・[See case details](./docs/assets/images/cases/meidensha_case.png)                                                                            |
| <a href="https://www.st-grp.co.jp/" target="_blank"><img src="./docs/assets/images/cases/st-grp_logo.jpg"></a>                    | **Sankyo Tateyama, Inc.** <br/> _Information buried within the company became quickly searchable with Amazon Kendra. By referring to GenU, we were able to promptly provide the functions we needed, such as meeting minutes generation._ <br/> ・[See case details](./docs/assets/images/cases/st-grp_case.png)                                                                                                                                                    |
| <a href="https://www.oisixradaichi.co.jp/" target="_blank"><img src="./docs/assets/images/cases/oisixradaichi_logo.png"></a>      | **Oisix ra daichi Inc.** <br/> _Through the use case development project using GenU, we were able to grasp the necessary resources, project structure, external support, and talent development, which helped us clarify our image for the internal deployment of generative AI._ <br/> ・[See case page](https://aws.amazon.com/jp/solutions/case-studies/oisix/)                                                                                                  |
| <a href="https://www.san-a.co.jp/" target="_blank"><img src="./docs/assets/images/cases/san-a_logo.png"></a>                      | **SAN-A CO., LTD.** <br/> _By utilizing Amazon Bedrock, our engineers' productivity has dramatically improved, accelerating the migration of our company-specific environment, which we had built in-house, to the cloud._ <br/> ・[See case details](./docs/assets/images/cases/san-a_case.png)<br/> ・[See case page](https://aws.amazon.com/jp/solutions/case-studies/san-a/)                                                                                    |

If you would like to have your use case featured, please contact us via [Issue](https://github.com/aws-samples/generative-ai-use-cases/issues).

## References

- [GitHub (Japanese): How to deploy GenU by one click](https://github.com/aws-samples/sample-one-click-generative-ai-solutions)
- [Blog (Japanese): GenU Use Case Builder for Creating and Distributing Generative AI Apps with No Code](https://aws.amazon.com/jp/blogs/news/genu-use-cases-builder/)
- [Blog (Japanese): How to Make RAG Projects Successful #1 ~ Or How to Fail Fast ~](https://aws.amazon.com/jp/builders-flash/202502/way-to-succeed-rag-project/)
- [Blog (Japanese): Debugging Methods to Improve Accuracy in RAG Chat](https://qiita.com/sugimount-a/items/7ed3c5fc1eb867e28566)
- [Blog (Japanese): Customizing GenU with No Coding Using Amazon Q Developer CLI](https://qiita.com/wadabee/items/659e189018ad1a08e152)
- [Blog (Japanese): How to Customize Generative AI Use Cases JP](https://aws.amazon.com/jp/blogs/news/how-to-generative-ai-use-cases-jp/)
- [Blog (Japanese): Generative AI Use Cases JP ~ First Contribution Guide](https://aws.amazon.com/jp/builders-flash/202504/genu-development-guide/)
- [Blog (Japanese): Let Generative AI Decline Unreasonable Requests ~ Integrating Generative AI into Browsers ~](https://aws.amazon.com/jp/builders-flash/202405/genai-sorry-message/)
- [Blog (Japanese): Developing an Interpreter with Amazon Bedrock!](https://aws.amazon.com/jp/builders-flash/202311/bedrock-interpreter/)
- [Video (Japanese): The Appeal and Usage of Generative AI Use Cases JP (GenU) for Thoroughly Considering Generative AI Use Cases](https://www.youtube.com/live/s1P5A2SIWgc?si=PBQ4ZHQXU4pDhL8A)

## Security

See [CONTRIBUTING](/CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
