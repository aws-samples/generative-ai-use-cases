import { z } from 'zod';
import {
  AGENT_SKILL_DESCRIPTION_MAX_LENGTH,
  AGENT_SKILL_INSTRUCTIONS_MAX_LENGTH,
  AGENT_SKILL_NAME_MAX_LENGTH,
  AGENT_SKILL_NAME_PATTERN,
} from '@generative-ai-use-cases/common';

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
      error:
        'Only uvx, npx, node, python, and python3 commands are allowed for MCP servers',
    }),
    args: z.array(z.string()).optional().default([]),
    env: z.record(z.string(), z.string()).optional().default({}),
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

// Skill Schemas
export const SkillIdSchema = z.string().uuid('Invalid skill ID format');

// BatchGetItem reads at most 100 keys at a time; the total length of the
// descriptions is what actually limits the skills of an agent.
export const SkillIdsSchema = z
  .array(SkillIdSchema)
  .max(100, 'Maximum 100 skills allowed')
  .optional()
  .default([]);

export const SkillRequestSchema = z.object({
  name: z
    .string()
    .min(1, 'Skill name is required')
    .max(
      AGENT_SKILL_NAME_MAX_LENGTH,
      `Skill name must be ${AGENT_SKILL_NAME_MAX_LENGTH} characters or less`
    )
    .regex(
      AGENT_SKILL_NAME_PATTERN,
      'Skill name must be lowercase letters, digits and single hyphens, not starting or ending with a hyphen'
    ),
  description: z
    .string()
    .trim()
    .min(1, 'Skill description is required')
    .max(
      AGENT_SKILL_DESCRIPTION_MAX_LENGTH,
      `Skill description must be ${AGENT_SKILL_DESCRIPTION_MAX_LENGTH.toLocaleString('en-US')} characters or less`
    ),
  instructions: z
    .string()
    .trim()
    .min(1, 'Skill instructions are required')
    .max(
      AGENT_SKILL_INSTRUCTIONS_MAX_LENGTH,
      `Skill instructions must be ${AGENT_SKILL_INSTRUCTIONS_MAX_LENGTH.toLocaleString('en-US')} characters or less`
    ),
});

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
  skillIds: SkillIdsSchema,
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
  skillIds: SkillIdsSchema,
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
  isPublic: z.boolean({ error: 'isPublic must be a boolean value' }),
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
export type SkillRequestValidation = z.infer<typeof SkillRequestSchema>;
export type MCPServerConfigValidation = z.infer<typeof MCPServerConfigSchema>;
