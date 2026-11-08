/**
 * Utility functions for converting between Strands and GenU formats
 */

import {
  ExtraData,
  Metadata,
  StrandsContentBlock,
  StrandsMessage,
  StrandsRole,
  StrandsStreamEvent,
  UnrecordedMessage,
  UploadedFileType,
} from 'generative-ai-use-cases';
import { convertTextDocumentToUtf8 } from '@generative-ai-use-cases/common';

/**
 * Re-encode a text document in a legacy Japanese charset (Shift_JIS, EUC-JP) as
 * UTF-8, the same way the Converse path does. Bedrock rejects EUC-JP documents
 * and reads Shift_JIS ones as mojibake, and AgentCore passes the bytes to
 * Bedrock unchanged. Other formats and UTF-8 come back as they were.
 */
const documentBytesAsUtf8 = (
  base64Data: string,
  format: string | undefined
): string => {
  if (!format) {
    return base64Data;
  }
  const binary = atob(base64Data);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const converted = convertTextDocumentToUtf8(bytes, format);
  if (converted === bytes) {
    return base64Data;
  }
  let out = '';
  for (let i = 0; i < converted.length; i += 0x8000) {
    out += String.fromCharCode(...converted.subarray(i, i + 0x8000));
  }
  return btoa(out);
};
/**
 * Convert GenU messages to Strands format
 */
export const convertToStrandsFormat = (
  messages: UnrecordedMessage[],
  uploadedFiles?: UploadedFileType[],
  base64Cache?: Record<string, string>
): StrandsMessage[] => {
  console.log('convertToStrandsFormat', uploadedFiles, base64Cache);
  return messages.map((message) => {
    const contentBlocks: StrandsContentBlock[] = [];

    // Add text content if present
    if (message.content && message.content.trim()) {
      contentBlocks.push({ text: message.content });
    }

    // Convert extraData to Strands content blocks
    if (message.extraData) {
      for (const data of message.extraData) {
        const contentBlock = convertExtraDataToStrandsContentBlock(
          data,
          uploadedFiles,
          base64Cache
        );
        if (contentBlock) {
          contentBlocks.push(contentBlock);
        }
      }
    }

    // Ensure at least one content block exists
    if (contentBlocks.length === 0) {
      contentBlocks.push({ text: message.content || '' });
    }

    return {
      role: message.role as StrandsRole,
      content: contentBlocks,
    };
  });
};

/**
 * Convert ExtraData to Strands content block
 */
const convertExtraDataToStrandsContentBlock = (
  data: ExtraData,
  uploadedFiles?: UploadedFileType[],
  base64Cache?: Record<string, string>
): StrandsContentBlock | null => {
  let base64Data: string | undefined;

  // Get base64 data based on source type
  if (data.source.type === 'base64') {
    base64Data = data.source.data;
  } else if (data.source.type === 's3') {
    // Try to find base64 data from uploadedFiles or base64Cache
    base64Data =
      uploadedFiles
        ?.find((uploadedFile) => uploadedFile.s3Url === data.source.data)
        ?.base64EncodedData?.replace(/^data:(.*,)?/, '') ??
      base64Cache?.[data.source.data]?.replace(/^data:(.*,)?/, '');
  }

  if (!base64Data) {
    console.warn('No base64 data found for extraData:', data);
    return null;
  }

  // Convert based on data type
  switch (data.type) {
    case 'image':
      return {
        image: {
          format: getImageFormatFromMimeType(data.source.mediaType),
          source: {
            bytes: base64Data,
          },
        },
      };

    case 'file': {
      const format = getDocumentFormatFromMimeType(data.source.mediaType);
      return {
        document: {
          format,
          name: data.name,
          source: {
            bytes: documentBytesAsUtf8(base64Data, format),
          },
        },
      };
    }

    case 'video':
      return {
        video: {
          format: getVideoFormatFromMimeType(data.source.mediaType),
          source: {
            bytes: base64Data,
          },
        },
      };

    default:
      console.warn('Unsupported extraData type:', data.type);
      return null;
  }
};

/**
 * Extract image format from MIME type
 */
const getImageFormatFromMimeType = (
  mimeType: string
): 'png' | 'jpeg' | 'gif' | 'webp' | undefined => {
  const formatMap: Record<string, 'png' | 'jpeg' | 'gif' | 'webp'> = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return formatMap[mimeType.toLowerCase()];
};

/**
 * Extract document format from MIME type
 */
const getDocumentFormatFromMimeType = (
  mimeType: string
):
  | 'pdf'
  | 'csv'
  | 'doc'
  | 'docx'
  | 'xls'
  | 'xlsx'
  | 'html'
  | 'txt'
  | 'md'
  | undefined => {
  const formatMap: Record<
    string,
    'pdf' | 'csv' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'html' | 'txt' | 'md'
  > = {
    'application/pdf': 'pdf',
    'text/csv': 'csv',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/html': 'html',
    'text/plain': 'txt',
    'text/markdown': 'md',
  };
  return formatMap[mimeType.toLowerCase()];
};

/**
 * Extract video format from MIME type
 */
const getVideoFormatFromMimeType = (
  mimeType: string
):
  | 'flv'
  | 'mkv'
  | 'mov'
  | 'mpeg'
  | 'mpg'
  | 'mp4'
  | 'three_gp'
  | 'webm'
  | 'wmv'
  | undefined => {
  const formatMap: Record<
    string,
    'flv' | 'mkv' | 'mov' | 'mpeg' | 'mpg' | 'mp4' | 'three_gp' | 'webm' | 'wmv'
  > = {
    'video/x-flv': 'flv',
    'video/x-matroska': 'mkv',
    'video/quicktime': 'mov',
    'video/mpeg': 'mpeg',
    'video/mp4': 'mp4',
    'video/3gpp': 'three_gp',
    'video/webm': 'webm',
    'video/x-ms-wmv': 'wmv',
  };
  return formatMap[mimeType.toLowerCase()];
};

/**
 * Convert File objects to Strands content blocks
 */
export const convertFilesToStrandsContentBlocks = async (
  files: File[]
): Promise<StrandsContentBlock[]> => {
  console.log('convertFilesToStrandsContentBlocks', files);
  const contentBlocks: StrandsContentBlock[] = [];

  for (const file of files) {
    try {
      const base64Data = await fileToBase64(file);
      const contentBlock = await convertFileToStrandsContentBlock(
        file,
        base64Data
      );
      if (contentBlock) {
        contentBlocks.push(contentBlock);
      }
    } catch (error) {
      console.error('Error converting file to Strands content block:', error);
    }
  }

  return contentBlocks;
};

/**
 * Convert a single File to base64 string
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Convert a single File to Strands content block
 */
const convertFileToStrandsContentBlock = async (
  file: File,
  base64Data: string
): Promise<StrandsContentBlock | null> => {
  const mimeType = file.type;
  // \s must not be used here: it also matches U+3000 (ideographic space) and tabs,
  // which Bedrock rejects. Consecutive spaces are rejected as well, and the name
  // is capped at 200 characters. Leading and trailing spaces are trimmed.
  const fileName =
    file.name
      .replace(/[^a-zA-Z0-9 \-()[\]]/g, 'X')
      .replace(/ {2,}/g, ' ')
      .trim()
      .substring(0, 200)
      .trimEnd() || 'file';

  // Determine file type based on MIME type
  if (mimeType.startsWith('image/')) {
    return {
      image: {
        format: getImageFormatFromMimeType(mimeType),
        source: {
          bytes: base64Data,
        },
      },
    };
  } else if (mimeType.startsWith('video/')) {
    return {
      video: {
        format: getVideoFormatFromMimeType(mimeType),
        source: {
          bytes: base64Data,
        },
      },
    };
  } else {
    // Treat as document
    const format = getDocumentFormatFromMimeType(mimeType);
    return {
      document: {
        format,
        name: fileName,
        source: {
          bytes: documentBytesAsUtf8(base64Data, format),
        },
      },
    };
  }
};

// DocumentBlock.name is at most 200 characters
const MAX_DOCUMENT_NAME_LENGTH = 200;

/**
 * Give every document in a request a unique name.
 *
 * Bedrock rejects a request in which two documents share a name
 * ("Messages can't contain duplicate document names"), and the check covers
 * every message in the request. Two files with the same name, or two Japanese
 * names of the same length (both become e.g. "XXXXXpdf"), would otherwise fail
 * the turn. The first occurrence keeps its name, later ones get " (2)",
 * " (3)" and so on, the same as the Converse path. Blocks are returned as
 * copies, only the renamed documents change.
 *
 * Today the AgentCore path does not resend earlier attachments (the stored
 * user message has no extraData, and convertToStrandsFormat is called without
 * the base64 cache), so in practice only names within the prompt collide.
 * Earlier messages are included so that the names stay unique if their
 * attachments are sent again in the future.
 */
export const makeDocumentNamesUnique = (
  messages: StrandsMessage[],
  prompt: StrandsContentBlock[]
): { messages: StrandsMessage[]; prompt: StrandsContentBlock[] } => {
  const usedNames = new Set<string>();
  const rename = (block: StrandsContentBlock): StrandsContentBlock => {
    if (!('document' in block) || !block.document.name) {
      return block;
    }
    const baseName = block.document.name;
    let name = baseName;
    for (let n = 2; usedNames.has(name); n++) {
      const suffix = ` (${n})`;
      name =
        baseName
          .substring(0, MAX_DOCUMENT_NAME_LENGTH - suffix.length)
          .trimEnd() + suffix;
    }
    usedNames.add(name);
    return name === baseName
      ? block
      : { ...block, document: { ...block.document, name } };
  };
  return {
    messages: messages.map((message) => ({
      ...message,
      content: message.content.map(rename),
    })),
    prompt: prompt.map(rename),
  };
};

/**
 * Convert Strands messages back to GenU format
 */
export const convertFromStrandsFormat = (
  messages: StrandsMessage[]
): UnrecordedMessage[] => {
  return messages.map((message) => {
    // Extract text content from content blocks
    const textContent = message.content
      .filter((block) => 'text' in block)
      .map((block) => ('text' in block ? block.text : ''))
      .join('\n');

    // Extract extra data from non-text content blocks
    const extraData: ExtraData[] = [];
    for (const block of message.content) {
      if ('image' in block && block.image.source) {
        extraData.push({
          type: 'image',
          name: 'image', // Default name for images
          source: {
            type: 'base64',
            mediaType: `image/${block.image.format}`,
            data: block.image.source.bytes,
          },
        });
      } else if ('document' in block && block.document.source) {
        extraData.push({
          type: 'file',
          name: block.document.name || 'document',
          source: {
            type: 'base64',
            mediaType: getDocumentMimeType(block.document.format || 'txt'),
            data: block.document.source.bytes,
          },
        });
      }
    }

    return {
      role: message.role,
      content: textContent,
      extraData: extraData.length > 0 ? extraData : undefined,
    };
  });
};

/**
 * Get MIME type from document format
 */
const getDocumentMimeType = (
  format:
    | 'pdf'
    | 'csv'
    | 'doc'
    | 'docx'
    | 'xls'
    | 'xlsx'
    | 'html'
    | 'txt'
    | 'md'
): string => {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    html: 'text/html',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  return mimeTypes[format] || 'application/octet-stream';
};

/**
 * Content block types for state tracking
 */
type ContentBlockType = 'text' | 'toolUse' | 'reasoning' | null;

/**
 * Stateful stream processor for Strands events
 */
export class StrandsStreamProcessor {
  private currentContentBlockType: ContentBlockType = null;
  private toolUseBuffer: string = '';
  private textBuffer: string = ''; // Text buffer for research agent
  private isResearchAgent: boolean = false; // Flag to identify research agent

  /**
   * Set whether this is a research agent request
   */
  setResearchAgent(isResearch: boolean): void {
    this.isResearchAgent = isResearch;
  }

  /**
   * Process a streaming event and return formatted content
   */
  processEvent(
    eventText: string
  ): { text: string; trace?: string; metadata?: Metadata } | null {
    try {
      const parsedEvent = JSON.parse(eventText);
      const streamEvent = parsedEvent.event as StrandsStreamEvent;

      if (!streamEvent) return null;

      // Handle message start event
      if (streamEvent.messageStart) {
        this.reset();
        return null;
      }

      // Handle content block start event
      if (streamEvent.contentBlockStart) {
        const start = streamEvent.contentBlockStart.start;

        if ('text' in start && start.text) {
          this.currentContentBlockType = 'text';
          // For research agent, buffer text to process <final_report> tags
          if (this.isResearchAgent) {
            this.textBuffer = start.text;
            return null; // Don't return yet, wait for contentBlockStop
          }
          return { text: start.text };
        } else if ('toolUse' in start && start.toolUse) {
          this.currentContentBlockType = 'toolUse';
          this.toolUseBuffer = '';
          return { text: '', trace: `\`\`\`${start.toolUse.name}\n` };
        }
      }

      // Handle content block delta event (incremental updates)
      if (streamEvent.contentBlockDelta) {
        const delta = streamEvent.contentBlockDelta.delta;

        if (delta.text) {
          this.currentContentBlockType = 'text';
          // For research agent, buffer text to process <final_report> tags
          if (this.isResearchAgent) {
            this.textBuffer += delta.text;
            return null; // Don't return yet, wait for contentBlockStop
          }
          return { text: delta.text };
        } else if (delta.toolUse) {
          this.currentContentBlockType = 'toolUse';
          this.toolUseBuffer += delta.toolUse.input;
          return { text: '', trace: delta.toolUse.input };
        } else if (delta.reasoningContent?.text) {
          this.currentContentBlockType = 'reasoning';
          return { text: '', trace: delta.reasoningContent.text };
        }
      }

      // Handle content block stop event
      if (streamEvent.contentBlockStop) {
        if (this.currentContentBlockType === 'text') {
          // For research agent, process buffered text for <final_report> tags
          if (this.isResearchAgent) {
            const bufferedText = this.textBuffer;
            this.textBuffer = '';

            // Check for final_report tags and split content
            if (
              bufferedText.includes('<final_report>') &&
              bufferedText.includes('</final_report>')
            ) {
              // Extract final report (inside tags) → chat
              const reportMatches = bufferedText.match(
                /<final_report>([\s\S]*?)<\/final_report>/g
              );
              let finalReport = '';
              if (reportMatches) {
                finalReport = reportMatches
                  .map((m) =>
                    m
                      .replace('<final_report>', '')
                      .replace('</final_report>', '')
                  )
                  .join('\n');
              }

              // Extract everything else (outside tags) → trace
              const trace = bufferedText
                .replace(/<final_report>[\s\S]*?<\/final_report>/g, '')
                .trim();

              // Return both
              const result: { text: string; trace?: string } = { text: '' };
              if (trace) {
                result.trace = trace;
              }
              if (finalReport) {
                result.text = finalReport;
              }

              this.currentContentBlockType = null;
              return result;
            }

            // No XML tags for research agent, return as trace
            const result = { text: '', trace: bufferedText };
            this.currentContentBlockType = null;
            return result;
          }

          // For non-research agents, return text normally
          const result = { text: '\n' };
          this.currentContentBlockType = null;
          return result;
        } else if (this.currentContentBlockType === 'toolUse') {
          // Close the tool use block
          const result = { text: '', trace: `\n\`\`\`\n` };
          this.currentContentBlockType = null;
          return result;
        }
        this.currentContentBlockType = null;
        return null;
      }

      // Handle message stop event
      if (streamEvent.messageStop) {
        this.reset();
        return null;
      }

      // Handle metadata event
      if (streamEvent.metadata) {
        return {
          text: '',
          metadata: {
            usage: {
              inputTokens: streamEvent.metadata.usage.inputTokens,
              outputTokens: streamEvent.metadata.usage.outputTokens,
              totalTokens: streamEvent.metadata.usage.totalTokens,
              cacheReadInputTokens:
                streamEvent.metadata.usage.cacheReadInputTokens,
              cacheWriteInputTokens:
                streamEvent.metadata.usage.cacheWriteInputTokens,
            },
          },
        };
      }

      // Handle error events
      const errorEvent =
        streamEvent.internalServerException ||
        streamEvent.modelStreamErrorException ||
        streamEvent.serviceUnavailableException ||
        streamEvent.throttlingException ||
        streamEvent.validationException;

      if (errorEvent) {
        return {
          text: `Error: ${errorEvent.message || 'An error occurred'}`,
        };
      }

      // Handle redact content event
      if (streamEvent.redactContent) {
        if (streamEvent.redactContent.redactAssistantContentMessage) {
          return {
            text: streamEvent.redactContent.redactAssistantContentMessage,
          };
        }
        return null;
      }

      return null;
    } catch (error) {
      console.error('Error processing Strands event:', error);
      return null;
    }
  }

  /**
   * Reset the processor state
   */
  reset(): void {
    this.currentContentBlockType = null;
    this.toolUseBuffer = '';
    this.textBuffer = '';
  }
}
