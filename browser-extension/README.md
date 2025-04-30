# Browser Extension

This is a browser extension that makes Generative AI Use Cases JP (abbreviated as GenU) more convenient to use.

> [!IMPORTANT]
> To use this browser extension, you need to deploy GenU in advance. First, please refer to [here](../README.md#deployment) for deployment instructions.

![Extension Image](../docs/assets/images/extension/extension_demo.png)

## Why Use Browser Extension?

While the standard GenU web app is convenient for using generative AI, having to open the web app and copy-paste content each time can sometimes feel cumbersome.
By using this browser extension, you can access generative AI without switching screens while browsing, making it even more convenient to utilize generative AI.
Please also refer to the [extension introduction article](https://aws.amazon.com/jp/builders-flash/202405/genai-sorry-message/).

### Use Cases

- Email and message replies
  - When using email or chat applications through a web browser, you can directly ask the generative AI to compose replies for you.
- Translation
  - You can translate internal company information without worrying about information leakage.
- Looking up word meanings
  - You can ask the LLM about technical terms, English words, or kanji characters whose readings you don't know.
- Summarization
  - You can quickly understand the overview of lengthy web content by having it summarized.
- Others
  - Since this browser extension allows you to freely customize prompts, various uses are possible depending on your ideas.

## How to Use

To use the browser extension, you need to build the extension and install the built files in your browser.

Please refer to the following instructions for details:

- [Build Instructions](../docs/en/EXTENSION_BUILD.md)
- [Installation Instructions](../docs/en/EXTENSION_INSTALL.md)
- [How to Use SAML Authentication](../docs/en/EXTENSION_SAML.md)

## FAQ

- Can anyone use the extension once it's installed?
  - Anyone who is registered as a user in GenU can use it after logging in.
  - Authentication settings follow those of GenU.
  - **Users who are not registered cannot use it at all.**
- Is it safe to input internal company information?
  - Amazon Bedrock does not use input data as training data, so you can use it with confidence ([reference](https://aws.amazon.com/jp/bedrock/faqs/)).
  - **Please thoroughly check your company's policies before inputting internal information.**
- Can I review content sent through the extension?
  - Content sent through the extension is not saved at all.
  - If you have a request for conversation history functionality, please post it as an Issue (we cannot promise implementation).
- Which browsers can I use it with?
  - We have confirmed it works with Google Chrome and Microsoft Edge.
- How can I distribute it within my company?
  - Please refer to [this method](../docs/en/EXTENSION_BUILD.md#distribution-method).
- I want to add preset prompts
  - Set prompts in `browser-extension/src/app/features/prompt-settings/presetPrompts.ts` and then "build + install" again.
- I want to use prompts from the GenU web app
  - You can use system prompts saved from the web app.
  - Configure usage from the "Prompt Settings" screen in the extension.
- Login fails
  - First, please check if you can log in normally to the GenU web app.
  - If you cannot log in to the web app:
    - You may not be registered as a user.
  - If you can log in to the web app:
    - The extension settings may be incorrect.
      - Open the "Settings" screen in the extension and check if each setting item is correct.
      - Setting values can be confirmed using [this method](../docs/en/EXTENSION_BUILD.md#for-other-users-windows-etc).
    - If you are using SAML integration, the Cognito settings may be incorrect.
      - Please check the Cognito settings by referring to [these instructions](../docs/en/EXTENSION_SAML.md).
