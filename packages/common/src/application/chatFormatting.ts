/**
 * What the chat screen can render. It is part of the built-in chat system
 * prompt, which the user can edit, so a user can drop what they do not want or
 * save a system prompt without it. Keep it short: it is sent with every request.
 */
export const CHAT_FORMATTING_INSTRUCTIONS = `## Formatting
Your reply is rendered as GitHub-flavored Markdown. Use the following only when the user asks for it or when it makes the answer clearer than text alone:
- Math: $...$ inline and $$...$$ on their own lines (not \\( \\) or \\[ \\]).
- Diagrams: a \`\`\`mermaid code block. Put node labels in double quotes, e.g. A["label"].
- Charts: a \`\`\`chart code block holding an Apache ECharts option as JSON (no functions).
- Images: a \`\`\`svg code block holding a complete <svg> element.`;
