import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DescribeVoicesCommand,
  PollyClient,
  Voice,
} from '@aws-sdk/client-polly';
import {
  ListPollyVoicesResponse,
  PollyEngine,
  PollyLanguage,
  PollyVoice,
} from 'generative-ai-use-cases';
import { ENGINES, mapPollyError } from './utils/pollyUtils';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// DescribeVoices is paginated, so follow NextToken until it is exhausted
const describeAllVoices = async (
  client: PollyClient,
  languageCode?: string
): Promise<Voice[]> => {
  const voices: Voice[] = [];
  let nextToken: string | undefined;
  do {
    const res = await client.send(
      new DescribeVoicesCommand({
        IncludeAdditionalLanguageCodes: true,
        ...(languageCode
          ? { LanguageCode: languageCode as Voice['LanguageCode'] }
          : {}),
        NextToken: nextToken,
      })
    );
    voices.push(...(res.Voices ?? []));
    nextToken = res.NextToken;
  } while (nextToken);
  return voices;
};

export const toPollyVoices = (
  voices: Voice[],
  languageCode?: string
): PollyVoice[] =>
  voices.flatMap((v) => {
    if (!v.Id) return [];
    const codes = [v.LanguageCode, ...(v.AdditionalLanguageCodes ?? [])].filter(
      (c): c is NonNullable<typeof c> => !!c
    );
    if (languageCode && !codes.includes(languageCode as never)) return [];
    const supportedEngines = ENGINES.filter((e) =>
      (v.SupportedEngines ?? []).includes(e as never)
    ) as PollyEngine[];
    if (supportedEngines.length === 0) return [];
    return [
      {
        id: v.Id,
        name: v.Name ?? v.Id,
        gender: v.Gender ?? '',
        languageCode: languageCode ?? v.LanguageCode ?? '',
        supportedEngines,
      },
    ];
  });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const languageCode = event.queryStringParameters?.languageCode;
    if (
      languageCode &&
      !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(languageCode)
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: 'languageCode is invalid.',
          code: 'INVALID_REQUEST',
        }),
      };
    }

    const client = new PollyClient({});
    const rawVoices = await describeAllVoices(client, languageCode);

    const languageMap = new Map<string, PollyLanguage>();
    for (const v of rawVoices) {
      const codes = [v.LanguageCode, ...(v.AdditionalLanguageCodes ?? [])];
      for (const code of codes) {
        if (code && !languageMap.has(code)) {
          languageMap.set(code, {
            code,
            name:
              code === v.LanguageCode && v.LanguageName ? v.LanguageName : code,
          });
        }
      }
    }

    const response: ListPollyVoicesResponse = {
      languages: Array.from(languageMap.values()).sort((a, b) =>
        a.code.localeCompare(b.code)
      ),
      voices: toPollyVoices(rawVoices, languageCode),
    };

    return { statusCode: 200, headers, body: JSON.stringify(response) };
  } catch (error) {
    console.log(error);
    const { statusCode, message, code } = mapPollyError(error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ message, code }),
    };
  }
};
