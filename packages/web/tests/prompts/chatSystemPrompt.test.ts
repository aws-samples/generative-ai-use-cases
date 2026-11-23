import { describe, expect, it } from 'vitest';
import { CHAT_FORMATTING_INSTRUCTIONS } from '@generative-ai-use-cases/common';
import { claudePrompter } from '../../src/prompts/claude';

describe('chat system prompt', () => {
  it('includes the formatting section, so the user can edit or remove it', () => {
    expect(claudePrompter.systemContext('/chat')).toContain(
      CHAT_FORMATTING_INSTRUCTIONS
    );
    expect(claudePrompter.systemContext('/chat/abc')).toContain(
      CHAT_FORMATTING_INSTRUCTIONS
    );
  });

  it('describes only what the chat renders', () => {
    for (const fence of ['```mermaid', '```chart', '```svg', '$$...$$']) {
      expect(CHAT_FORMATTING_INSTRUCTIONS).toContain(fence);
    }
  });

  it('leaves prompts with a fixed output format alone', () => {
    expect(claudePrompter.systemContext('/writer')).not.toContain(
      CHAT_FORMATTING_INSTRUCTIONS
    );
    expect(claudePrompter.systemContext('/translate')).not.toContain(
      CHAT_FORMATTING_INSTRUCTIONS
    );
  });
});
