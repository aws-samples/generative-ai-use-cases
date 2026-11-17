import { Router, Request, Response } from 'express';
import {
  handleCreateAgent,
  handleGetAgent,
  handleUpdateAgent,
  handleDeleteAgent,
  handleListUserAgents,
  handleListPublicAgents,
  handleCloneAgent,
  handleListFavoriteAgents,
  handleToggleAgentFavorite,
} from '../../agentBuilder/handlers/agent-handlers';
import { queryParams, requireUserName } from '../../utils/http';
import {
  CreateAgentRequest,
  CloneAgentRequest,
  UpdateAgentRequest,
} from 'generative-ai-use-cases';

export const router = Router();

// Helper: extract userId from request
const getUserId = (req: Request) => requireUserName(req);

// Helper: extract pagination params
const getPagination = (req: Request) => {
  const query = queryParams(req);
  return {
    exclusiveStartKey: query.exclusiveStartKey || query.nextToken,
    limit: query.limit ? parseInt(query.limit, 10) : undefined,
  };
};

// Helper: wrap agentBuilder handler with common error handling
const agentRoute =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error('Agent builder error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

// Helper: send handler result as response
const sendResult = (
  res: Response,
  result: { statusCode: number; body?: string }
) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(result.statusCode).send(result.body || '{}');
};

// List public agents
router.get(
  '/public',
  agentRoute(async (req, res) => {
    const { exclusiveStartKey, limit } = getPagination(req);
    const result = await handleListPublicAgents(
      getUserId(req),
      exclusiveStartKey,
      limit
    );
    sendResult(res, result);
  })
);

// List favorite agents
router.get(
  '/favorites',
  agentRoute(async (req, res) => {
    const { exclusiveStartKey, limit } = getPagination(req);
    const result = await handleListFavoriteAgents(
      getUserId(req),
      exclusiveStartKey,
      limit
    );
    sendResult(res, result);
  })
);

// List user's agents
router.get(
  '/my',
  agentRoute(async (req, res) => {
    const { exclusiveStartKey, limit } = getPagination(req);
    const result = await handleListUserAgents(
      getUserId(req),
      exclusiveStartKey,
      limit
    );
    sendResult(res, result);
  })
);

// Clone / Import agent (same handler)
const handleCloneOrImport = agentRoute(async (req, res) => {
  const result = await handleCloneAgent(
    getUserId(req),
    req.body as CloneAgentRequest
  );
  sendResult(res, result);
});
router.post('/clone', handleCloneOrImport);
router.post('/import', handleCloneOrImport);

// Toggle favorite
router.post(
  '/:agentId/favorite',
  agentRoute(async (req, res) => {
    const result = await handleToggleAgentFavorite(
      getUserId(req),
      req.params.agentId
    );
    sendResult(res, result);
  })
);

// Get agent
router.get(
  '/:agentId',
  agentRoute(async (req, res) => {
    const result = await handleGetAgent(getUserId(req), req.params.agentId);
    sendResult(res, result);
  })
);

// Update agent
router.put(
  '/:agentId',
  agentRoute(async (req, res) => {
    const result = await handleUpdateAgent(
      getUserId(req),
      req.params.agentId,
      req.body as UpdateAgentRequest
    );
    sendResult(res, result);
  })
);

// Delete agent
router.delete(
  '/:agentId',
  agentRoute(async (req, res) => {
    const result = await handleDeleteAgent(getUserId(req), req.params.agentId);
    sendResult(res, result);
  })
);

// Create agent
router.post(
  '/',
  agentRoute(async (req, res) => {
    const result = await handleCreateAgent(
      getUserId(req),
      req.body as CreateAgentRequest
    );
    sendResult(res, result);
  })
);

// List user agents (default)
router.get(
  '/',
  agentRoute(async (req, res) => {
    const { exclusiveStartKey, limit } = getPagination(req);
    const result = await handleListUserAgents(
      getUserId(req),
      exclusiveStartKey,
      limit
    );
    sendResult(res, result);
  })
);
