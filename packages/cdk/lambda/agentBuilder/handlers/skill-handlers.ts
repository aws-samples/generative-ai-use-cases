import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import * as skillService from '../services/skill-service';
import {
  validateAgentId,
  validateUserId,
} from '../validation/request-validation';
import {
  SkillIdSchema,
  SkillIdsSchema,
  SkillRequestSchema,
} from '../validation/schemas';
import { createSuccessResponse } from '../utils/response-utils';
import { handleError, ValidationError } from '../utils/error-handling';

const check = (result: { isValid: boolean; error?: string }) => {
  if (!result.isValid) throw new ValidationError(result.error!);
};

const parse = <T>(schema: z.ZodType<T>, value: unknown, message?: string) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(
      message ?? result.error.issues.map((i) => i.message).join(', ')
    );
  }
  return result.data;
};

const skillIdOf = (skillId: string) =>
  parse(SkillIdSchema, skillId, 'Invalid skill ID format');

// Checks the user, runs the action and turns errors into responses
const respond = async (
  userId: string,
  action: () => Promise<unknown>,
  statusCode?: number
): Promise<APIGatewayProxyResult> => {
  try {
    check(validateUserId(userId));
    return createSuccessResponse(await action(), statusCode);
  } catch (error) {
    return handleError(error as Error);
  }
};

export const handleCreateSkill = (userId: string, request: unknown) =>
  respond(
    userId,
    () => skillService.createSkill(userId, parse(SkillRequestSchema, request)),
    201
  );

export const handleListSkills = (userId: string) =>
  respond(userId, () => skillService.listSkills(userId));

export const handleGetSkill = (userId: string, skillId: string) =>
  respond(userId, () => skillService.getSkill(userId, skillIdOf(skillId)));

export const handleUpdateSkill = (
  userId: string,
  skillId: string,
  request: unknown
) =>
  respond(userId, () =>
    skillService.updateSkill(
      userId,
      skillIdOf(skillId),
      parse(SkillRequestSchema, request)
    )
  );

export const handleDeleteSkill = (userId: string, skillId: string) =>
  respond(userId, async () => {
    await skillService.deleteSkill(userId, skillIdOf(skillId));
    return { success: true };
  });

export const handleListSkillsOfAgent = (userId: string, agentId: string) =>
  respond(userId, () => {
    check(validateAgentId(agentId));
    return skillService.listSkillsOfAgent(userId, agentId);
  });

export const handleListSkillContents = (userId: string, skillIds: string[]) =>
  respond(userId, () =>
    skillService.listSkillContents(
      userId,
      parse(SkillIdsSchema, skillIds, 'Invalid skill IDs')
    )
  );
