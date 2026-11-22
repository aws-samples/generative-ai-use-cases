import { ShownMessage } from 'generative-ai-use-cases';

// Sent after a response that stopped at the output token limit. Claude Sonnet
// 4.6 / Opus 4.6 and later reject a conversation that ends with an assistant
// message (prefill), so the rest is requested in a user message.
export const CONTINUE_OUTPUT_PROMPT =
  'Your previous response was cut off because it reached the output limit. Continue it from exactly where it stopped. Do not repeat what you already wrote, and do not add any introduction.';

export const withContinueRequest = (
  messages: ShownMessage[]
): ShownMessage[] => [
  ...messages,
  { role: 'user', content: CONTINUE_OUTPUT_PROMPT },
];
