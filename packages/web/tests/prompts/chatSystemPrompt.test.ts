import { describe, expect, it } from 'vitest';
import { claudePrompter } from '../../src/prompts/claude';

describe('chat system prompt', () => {
  it('includes the formatting section, so the user can edit or remove it', () => {
    expect(claudePrompter.systemContext('/chat')).toContain('## Formatting');
    expect(claudePrompter.systemContext('/chat/abc')).toContain(
      '## Formatting'
    );
  });

  it('describes only what the chat renders', () => {
    for (const fence of ['```mermaid', '```chart', '```svg', '$$...$$']) {
      expect(claudePrompter.systemContext('/chat')).toContain(fence);
    }
  });

  it('leaves prompts with a fixed output format alone', () => {
    expect(claudePrompter.systemContext('/writer')).not.toContain(
      '## Formatting'
    );
    expect(claudePrompter.systemContext('/translate')).not.toContain(
      '## Formatting'
    );
  });
});
