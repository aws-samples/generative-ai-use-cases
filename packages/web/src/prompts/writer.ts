import { Model, UnrecordedMessage } from 'generative-ai-use-cases';
import { v4 as uuidv4 } from 'uuid';
import { MODELS } from '../hooks/useModel';

export type WriterOption =
  | 'continue'
  | 'improve'
  | 'shorter'
  | 'longer'
  | 'fix'
  | 'zap'
  | 'search'
  | 'collectData'
  | 'factCheck'
  | 'comment';

export type WriterPromptResult = {
  messages: UnrecordedMessage[];
  overrideModel?: Model;
};

export const generateWriterPrompt = (
  prompt: string,
  option: WriterOption,
  command?: string
): WriterPromptResult => {
  prompt = prompt.replace(/<mark[^>]*>/g, '').replace(/<\/mark>/g, '');

  const options: Record<WriterOption, WriterPromptResult> = {
    continue: {
      messages: [
        {
          role: 'system',
          content: `Continue the existing article based on the context.
Focus on the second half of the article.
Answer is limited to 200 characters and must end with a complete sentence.
Output only within <output> tags.
If appropriate, use Markdown format.`,
        },
        {
          role: 'user',
          content: `<input>${prompt}</input>`,
        },
        {
          role: 'assistant',
          content: '<output>',
        },
      ],
    },
    improve: {
      messages: [
        {
          role: 'system',
          content: `Improve the given article.
Write concisely and logically, easy to understand, and based on data (if there is no data, use placeholder X).
Answer is limited to 200 characters and must end with a complete sentence.
Output only within <output> tags.
If appropriate, use Markdown format.`,
        },
        {
          role: 'user',
          content: `<input>${prompt}</input>`,
        },
        {
          role: 'assistant',
          content: '<output>',
        },
      ],
    },
    shorter: {
      messages: [
        {
          role: 'system',
          content: `Make the given article shorter and more concise.
Answer is limited to 200 characters and must end with a complete sentence.
Output only within <output> tags.
If appropriate, use Markdown format.`,
        },
        {
          role: 'user',
          content: `<input>${prompt}</input>`,
        },
        {
          role: 'assistant',
          content: '<output>',
        },
      ],
    },
    longer: {
      messages: [
        {
          role: 'system',
          content: `Make the given article longer and more detailed.
Output only within <output> tags.
If appropriate, use Markdown format.`,
        },
        {
          role: 'user',
          content: `<input>${prompt}</input>`,
        },
        {
          role: 'assistant',
          content: '<output>',
        },
      ],
    },
    fix: {
      messages: [
        {
          role: 'system',
          content: `You are a proofreader. Correct the grammar and terminology of the given article.
Answer is limited to 200 characters and must end with a complete sentence.
Output only within <output> tags.
If appropriate, use Markdown format.`,
        },
        {
          role: 'user',
          content: `<input>${prompt}</input>`,
        },
        {
          role: 'assistant',
          content: '<output>',
        },
      ],
    },
    zap: {
      messages: [
        {
          role: 'system',
          content: `Generate an article based on the user's input and the command.
Output only within <output> tags.
If appropriate, use Markdown format.`,
        },
        {
          role: 'user',
          content: `<input>${prompt}</input><command>${command}</command>`,
        },
        {
          role: 'assistant',
          content: '<output>',
        },
      ],
    },
    search: {
      messages: [
        {
          role: 'user',
          content: `<input>${prompt}</input><command>${command}</command>`,
        },
      ],
      overrideModel: {
        type: 'bedrockAgent',
        modelId: MODELS.searchAgent || '',
        sessionId: uuidv4(),
      },
    },
    collectData: {
      messages: [
        {
          role: 'user',
          content: `Gather data and evidence from the following article.
List parts with insufficient evidence and investigate them.
<input>${prompt}</input>`,
        },
      ],
      overrideModel: {
        type: 'bedrockAgent',
        modelId: MODELS.searchAgent || '',
        sessionId: uuidv4(),
      },
    },
    factCheck: {
      messages: [
        {
          role: 'user',
          content: `The following is an article provided by the user.
List the facts stated and perform fact checking for each.
<input>${prompt}</input>`,
        },
      ],
      overrideModel: {
        type: 'bedrockAgent',
        modelId: MODELS.searchAgent || '',
        sessionId: uuidv4(),
      },
    },
    comment: {
      messages: [
        {
          role: 'system',
          content: `You are a proofreader who understands the user's intent and article and points out the appropriate corrections.
The user will provide an article to be corrected using the <input> tag.
Please point out the <What to point out> and propose a correction if there is one.
If there is a correction proposal, propose it using the replace tag.
Output only within <output> tags. Output in language of the article.
Output in the following <output-format></output-format> format:
<output-format>[{"excerpt": string; "replace"?: string; "comment"?: string }]</output-format>

<What to point out>
- Misspellings
- Grammar mistakes
- Insufficient evidence
- Lack of logical reasoning
- Insufficient analysis
- Optimistic expressions
- Lack of specificity
</What to point out>

Important! Only output sentences with errors.
If there are no issues, output an empty array.`,
        },
        {
          role: 'user',
          content: `<input>${prompt}</input>`,
        },
        {
          role: 'assistant',
          content: '<output>',
        },
      ],
    },
  };

  return options[option];
};
