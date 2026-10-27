import { z } from 'zod';

// MCP Server Reference Schema (what users specify)
export const MCPServerReferenceSchema = z
  .string()
  .min(1, 'MCP server name is required')
  .max(100, 'MCP server name must be 100 characters or less')
  .regex(/^[a-zA-Z0-9._-]+$/, 'MCP server name contains invalid characters');

// MCP Server Configuration Schema (for internal use)
export const MCPServerConfigSchema = z
  .object({
    name: z
      .string()
      .min(1, 'MCP server name is required')
      .max(100, 'MCP server name must be 100 characters or less'),
    command: z.enum(['uvx', 'npx', 'node', 'python', 'python3'], {
      errorMap: () => ({
        message:
          'Only uvx, npx, node, python, and python3 commands are allowed for MCP servers',
      }),
    }),
    args: z.array(z.string()).optional().default([]),
    env: z.record(z.string()).optional().default({}),
    enabled: z.boolean().optional().default(true),
    description: z
      .string()
      .max(500, 'MCP server description must be 500 characters or less')
      .optional(),
    version: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate args don't contain dangerous patterns
      const dangerousPatterns = [
        '--',
        '&&',
        '||',
        ';',
        '|',
        '>',
        '<',
        '`',
        '$',
        'rm',
        'sudo',
        'chmod',
      ];
      for (const arg of data.args || []) {
        if (
          dangerousPatterns.some((pattern) => String(arg).includes(pattern))
        ) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Dangerous pattern detected in MCP server arguments',
    }
  )
  .refine(
    (data) => {
      // Validate environment variables
      const allowedEnvVars = [
        'AWS_REGION',
        'FASTMCP_LOG_LEVEL',
        'MCP_SERVER_NAME',
        'LOG_LEVEL',
        'DEBUG',
        'VERBOSE',
      ];

      for (const key of Object.keys(data.env || {})) {
        if (!allowedEnvVars.includes(key) && !key.startsWith('MCP_')) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Environment variable not allowed',
    }
  );

// Agent Schemas
export const CreateAgentRequestSchema = z.object({
  name: z
    .string()
    .min(1, 'Agent name is required')
    .max(100, 'Agent name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  systemPrompt: z
    .string()
    .min(1, 'System prompt is required')
    .max(10000, 'System prompt must be 10,000 characters or less'),
  modelId: z.string().min(1, 'Model ID is required'),
  mcpServers: z
    .array(MCPServerReferenceSchema)
    .max(10, 'Maximum 10 MCP servers allowed')
    .optional()
    .default([]),
  codeExecutionEnabled: z.boolean().optional().default(false),
  webSearchEnabled: z.boolean().optional().default(false),
  isPublic: z.boolean().optional().default(false),
  tags: z
    .array(z.string().max(50, 'Each tag must be 50 characters or less'))
    .max(10, 'Maximum 10 tags allowed')
    .optional()
    .default([]),
  createdByEmail: z.string().email().optional(),
});

export const UpdateAgentRequestSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID format'),
  name: z
    .string()
    .min(1, 'Agent name is required')
    .max(100, 'Agent name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less'),
  systemPrompt: z
    .string()
    .min(1, 'System prompt is required')
    .max(10000, 'System prompt must be 10,000 characters or less'),
  modelId: z.string().min(1, 'Model ID is required'),
  mcpServers: z
    .array(MCPServerReferenceSchema)
    .max(10, 'Maximum 10 MCP servers allowed'),
  codeExecutionEnabled: z.boolean().optional().default(false),
  webSearchEnabled: z.boolean().optional().default(false),
  isPublic: z.boolean().optional().default(false),
  tags: z
    .array(z.string().max(50, 'Each tag must be 50 characters or less'))
    .max(10, 'Maximum 10 tags allowed')
    .optional()
    .default([]),
  // version removed - using starCount instead
  createdByEmail: z.string().email().optional(),
});

export const ShareAgentRequestSchema = z.object({
  isPublic: z.boolean({ required_error: 'isPublic must be a boolean value' }),
});

export const CloneAgentRequestSchema = z.object({
  sourceAgentId: z.string().uuid('Invalid source agent ID format'),
  name: z
    .string()
    .max(100, 'Agent name must be 100 characters or less')
    .optional(),
});

// Common validation schemas
export const AgentIdSchema = z.string().uuid('Invalid agent ID format');
export const UserIdSchema = z.string().min(1, 'User ID is required');
export const PaginationKeySchema = z.string().optional();

// Request body validation helper
export const RequestBodySchema = z.string().min(1, 'Request body is required');

// Export types for TypeScript - use common types from generative-ai-use-cases
// These are kept for validation purposes only
export type CreateAgentRequestValidation = z.infer<
  typeof CreateAgentRequestSchema
>;
export type UpdateAgentRequestValidation = z.infer<
  typeof UpdateAgentRequestSchema
>;
export type ShareAgentRequestValidation = z.infer<
  typeof ShareAgentRequestSchema
>;
export type CloneAgentRequestValidation = z.infer<
  typeof CloneAgentRequestSchema
>;
export type MCPServerConfigValidation = z.infer<typeof MCPServerConfigSchema>;
