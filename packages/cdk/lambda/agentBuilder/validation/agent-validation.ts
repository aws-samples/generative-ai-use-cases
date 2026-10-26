import { z } from 'zod';
import {
  CreateAgentRequestSchema,
  UpdateAgentRequestSchema,
  CreateAgentRequestValidation,
  UpdateAgentRequestValidation,
} from './schemas';
import { ValidationResult } from 'generative-ai-use-cases';

// ValidationResult interface is now imported from generative-ai-use-cases types

/**
 * Validate create agent request using Zod
 * @param request Create agent request to validate
 * @returns Validation result with validated data
 */
export function validateCreateAgentRequest(
  request: unknown
): ValidationResult<CreateAgentRequestValidation> {
  try {
    const validatedData = CreateAgentRequestSchema.parse(request);
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
 * Validate update agent request using Zod
 * @param request Update agent request to validate
 * @returns Validation result with validated data
 */
export function validateUpdateAgentRequest(
  request: unknown
): ValidationResult<UpdateAgentRequestValidation> {
  try {
    const validatedData = UpdateAgentRequestSchema.parse(request);
    return { isValid: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((err) => err.message).join(', ');
      return { isValid: false, error: errorMessage };
    }
    return { isValid: false, error: 'Invalid request format' };
  }
}
