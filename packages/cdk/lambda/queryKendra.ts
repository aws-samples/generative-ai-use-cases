import { Request, Response } from 'express';
import { sendJson } from './utils/http';
import {
  AttributeFilter,
  KendraClient,
  QueryCommand,
} from '@aws-sdk/client-kendra';
import { QueryKendraRequest } from 'generative-ai-use-cases';

const INDEX_ID = process.env.INDEX_ID;
const LANGUAGE = process.env.LANGUAGE;

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req = (request.body ?? {}) as QueryKendraRequest;
  const query = req.query;

  if (!query) {
    return sendJson(response, 400, { error: 'query is not specified' });
  }

  // The default language is English, so language settings must be done.
  const attributeFilter: AttributeFilter = {
    AndAllFilters: [
      {
        EqualsTo: {
          Key: '_language_code',
          Value: {
            StringValue: LANGUAGE,
          },
        },
      },
    ],
  };

  const kendra = new KendraClient({});
  const queryCommand = new QueryCommand({
    IndexId: INDEX_ID,
    QueryText: query,
    AttributeFilter: attributeFilter,
  });

  const queryRes = await kendra.send(queryCommand);

  return sendJson(response, 200, queryRes);
};
