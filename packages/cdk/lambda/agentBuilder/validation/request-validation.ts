import { z } from 'zod';
import {
  ShareAgentRequestSchema,
  CloneAgentRequestSchema,
  AgentIdSchema,
  UserIdSchema,
  PaginationKeySchema,
  RequestBodySchema,
  ShareAgentRequestValidation,
  CloneAgentRequestValidation,
} from './schemas';
import { ValidationResult } from 'generative-ai-use-cases';

/**
 * Validate share agent request using Zod
 * @param request Share agent request to validate
 * @returns Validation result with validated data
 */
export function validateShareAgentRequest(
  request: unknown
): ValidationResult<ShareAgentRequestValidation> {
  try {
    const validatedData = ShareAgentRequestSchema.parse(request);
    return { isValid: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((err) => err.message).join(', ');
      return { isValid: false, error: errorMessage };
    }
    return { isValid: false, error: 'Invalid request format' };
  }
}

/**
 * Validate import agent request using Zod
 * @param request Import agent request to validate
 * @returns Validation result with validated data
 */
export function validateCloneAgentRequest(
  request: unknown
): ValidationResult<CloneAgentRequestValidation> {
  try {
    const validatedData = CloneAgentRequestSchema.parse(request);
    return { isValid: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((err) => err.message).join(', ');
      return { isValid: false, error: errorMessage };
    }
    return { isValid: false, error: 'Invalid request format' };
  }
}

/**
 * Validate agent ID parameter using Zod
 * @param agentId Agent ID to validate
 * @returns Validation result
 */
export function validateAgentId(agentId: unknown): ValidationResult {
  try {
    AgentIdSchema.parse(agentId);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((err) => err.message).join(', ');
      return { isValid: false, error: errorMessage };
    }
    return { isValid: false, error: 'Invalid agent ID format' };
  }
}

/**
 * Validate user ID parameter using Zod
 * @param userId User ID to validate
 * @returns Validation result
 */
export function validateUserId(userId: unknown): ValidationResult {
  try {
    UserIdSchema.parse(userId);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((err) => err.message).join(', ');
      return { isValid: false, error: errorMessage };
    }
    return { isValid: false, error: 'Invalid user ID format' };
  }
}

/**
 * Validate pagination parameters using Zod
 * @param exclusiveStartKey Exclusive start key for pagination
 * @returns Validation result
 */
export function validatePaginationParams(
  exclusiveStartKey: unknown
): ValidationResult {
  try {
    PaginationKeySchema.parse(exclusiveStartKey);
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid pagination key format' };
  }
}

/**
 * Validate and parse request body using Zod
 * @param body Request body string
 * @returns Parsed object or validation error
 */
export function validateAndParseRequestBody<T>(
  body: string | null
): { isValid: true; data: T } | ValidationResult<never> {
  try {
    // First validate that we have a body
    const validBody = RequestBodySchema.parse(body);

    // Then parse JSON
    const data = JSON.parse(validBody) as T;
    return { isValid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: 'Request body is required' };
    }
    return { isValid: false, error: 'Invalid JSON in request body' };
  }
}
