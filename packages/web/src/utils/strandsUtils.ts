import {
  StrandsContentBlock,
  UnrecordedMessage,
  StrandsRole,
  StreamingChunk,
} from 'generative-ai-use-cases';

/**
 * Convert UnrecordedMessage array to Strands format
 */
export const convertToStrandsFormat = (messages: UnrecordedMessage[]) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => {
      // Convert message content to Strands format
      let strandsContent: StrandsContentBlock[];

      // Handle text content
      if (typeof msg.content === 'string') {
        strandsContent = [{ text: msg.content }];
      }
      // Handle extraData if present (images, files, etc.)
      // TODO: Refactor
      else if (msg.extraData && msg.extraData.length > 0) {
        strandsContent = [];

        // Add text content if present
        if (msg.content) {
          strandsContent.push({ text: msg.content });
        }

        // Add extra data (images, files, etc.)
        msg.extraData.forEach((extra) => {
          if (extra.type === 'image' && extra.source.type === 'base64') {
            // Determine image format based on file name or default to png
            let format: 'png' | 'jpeg' | 'gif' | 'webp' = 'png';
            const fileName = extra.name.toLowerCase();

            if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
              format = 'jpeg';
            } else if (fileName.endsWith('.gif')) {
              format = 'gif';
            } else if (fileName.endsWith('.webp')) {
              format = 'webp';
            }

            strandsContent.push({
              image: {
                format,
                source: {
                  bytes: extra.source.data,
                },
              },
            });
          } else if (extra.type === 'file') {
            // Determine document format based on file extension
            let format:
              | 'pdf'
              | 'csv'
              | 'doc'
              | 'docx'
              | 'xls'
              | 'xlsx'
              | 'html'
              | 'txt'
              | 'md'
              | undefined;
            const extension = extra.name.split('.').pop()?.toLowerCase();

            if (extension === 'pdf') format = 'pdf';
            else if (extension === 'csv') format = 'csv';
            else if (extension === 'doc') format = 'doc';
            else if (extension === 'docx') format = 'docx';
            else if (extension === 'xls') format = 'xls';
            else if (extension === 'xlsx') format = 'xlsx';
            else if (extension === 'html') format = 'html';
            else if (extension === 'txt') format = 'txt';
            else if (extension === 'md') format = 'md';

            strandsContent.push({
              document: {
                format,
                name: extra.name,
                source: {
                  bytes: extra.source.data,
                },
              },
            });
          }
        });
      } else {
        // Default to empty text if no content
        strandsContent = [{ text: '' }];
      }

      return {
        role: msg.role as StrandsRole,
        content: strandsContent,
      };
    });
};

/**
 * Process Strands content blocks into plain text
 */
export const processStrandsContent = (
  contentBlocks: StrandsContentBlock[]
): string => {
  if (!Array.isArray(contentBlocks)) {
    return '';
  }

  let extractedText = '';

  // TODO: Refactor
  for (const block of contentBlocks) {
    // Handle different content block types based on their keys
    if ('text' in block) {
      // Text content block
      extractedText += block.text;
    } else if ('image' in block) {
      // Image content block with new structure
      const format = block.image.format || 'unknown';
      extractedText += `[Image: ${format}]`;
    } else if ('document' in block) {
      // Document content block with new structure
      const format = block.document.format || 'unknown';
      const name = block.document.name || 'document';
      extractedText += `[Document: ${name} (${format})]`;
    } else if ('video' in block) {
      // Video content block
      extractedText += `[Video]`;
    } else if ('toolUse' in block) {
      // Tool use content block
      const toolName = block.toolUse.name || '';
      extractedText += `[Tool Use: ${toolName}]`;
    } else if ('toolResult' in block) {
      // Tool result content block
      const content = block.toolResult.content;
      if (typeof content === 'string') {
        extractedText += `\n[Tool Result: ${content}]\n`;
      } else if (content) {
        extractedText += `\n[Tool Result: ${JSON.stringify(content)}]\n`;
      }
    } else if ('guardContent' in block) {
      // Guard content block
      extractedText += `[Guard Content]`;
    } else if ('cachePoint' in block) {
      // Cache point content block
      extractedText += `[Cache Point]`;
    } else if ('reasoningContent' in block) {
      // Reasoning content block
      extractedText += `[Reasoning Content]`;
    } else if ('citationsContent' in block) {
      // Citations content block
      extractedText += `[Citations Content]`;
    } else {
      // Unknown block type
      console.log('Unknown content block type:', block);
    }
  }

  return extractedText;
};

/**
 * Convert Strands format response to the format expected by the frontend
 */
export const convertStrandsToGenU = (strandsData: string): string => {
  // TODO: Refactor
  try {
    // Try to parse the data as JSON
    const parsed = JSON.parse(strandsData);

    // Check for GenU format (already converted)
    if (parsed && parsed.output && parsed.output.message) {
      const genuContent = parsed.output.message.content;
      if (Array.isArray(genuContent)) {
        return genuContent.map((item) => item.text || '').join('');
      }
    }

    // Check if it's a Strands format response
    if (parsed) {
      // Case 1: Direct message object with content array
      if (parsed.message && parsed.message.content) {
        return processStrandsContent(
          parsed.message.content as StrandsContentBlock[]
        );
      }

      // Case 2: Messages array
      if (parsed.messages && parsed.messages.length > 0) {
        // Find the assistant message (usually the last one)
        const assistantMessage = parsed.messages.find(
          (msg: { role: string }) => msg.role === 'assistant'
        );
        if (assistantMessage && assistantMessage.content) {
          return processStrandsContent(
            assistantMessage.content as StrandsContentBlock[]
          );
        }

        // If no assistant message found, use the last message
        const lastMessage = parsed.messages[parsed.messages.length - 1];
        if (lastMessage && lastMessage.content) {
          return processStrandsContent(
            lastMessage.content as StrandsContentBlock[]
          );
        }
      }

      // Case 3: Direct content array (less common)
      if (Array.isArray(parsed.content)) {
        return processStrandsContent(parsed.content as StrandsContentBlock[]);
      }

      // Case 4: Simple text response
      if (typeof parsed === 'string') {
        return parsed;
      }

      // Case 5: Raw text in a different format
      if (parsed.text) {
        return parsed.text;
      }
    }

    // If it doesn't match any expected format, return the original string
    return strandsData;
  } catch (e) {
    // If parsing fails, return the original string
    return strandsData;
  }
};

/**
 * Process a chunk of Strands data into a StreamingChunk
 */
export const processChunk = (chunkText: string): StreamingChunk => {
  // Convert Strands format to GenU format if needed
  const processedText = convertStrandsToGenU(chunkText);

  // Create a streaming chunk similar to MCP
  return {
    text: processedText,
    trace: undefined, // Agent Core Runtime doesn't have trace
  };
};
