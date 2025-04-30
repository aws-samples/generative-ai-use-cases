import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { parse } from 'node-html-parser';
import sanitizeHtml from 'sanitize-html';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const url = event?.queryStringParameters?.url;

    if (!url) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'url is missing' }),
      };
    }

    const res = await fetch(url);
    const html = await res.text();
    // Fix invalid tags
    const cleanHtml = sanitizeHtml(html, {
      // body and html are removed by default, so this option prevents that
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'body', 'html'],
    });
    const root = parse(cleanHtml, {
      comment: false,
      blockTextElements: {
        script: false,
        noScript: false,
        style: false,
        pre: false,
      },
    });
    const text = root?.querySelector('body')?.removeWhitespace().text;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ text }),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
