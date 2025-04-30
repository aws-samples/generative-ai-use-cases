import {
  AgentInput,
  AgentOutput,
  BraveSearchResult,
} from 'generative-ai-use-cases';

export const handler = async (event: AgentInput): Promise<AgentOutput> => {
  try {
    // Params
    const props = event.requestBody.content['application/json'].properties;
    let keyword = '';
    for (const prop of props) {
      if (prop.name === 'keyword') {
        keyword = prop.value;
      }
    }

    // Search
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${keyword}&count=3&text_decorations=0`;
    const searchApiKey = process.env.SEARCH_API_KEY || '';
    const response = await fetch(searchUrl, {
      headers: {
        'X-Subscription-Token': searchApiKey,
      },
    });
    const data = await response.json();
    console.log(JSON.stringify(data));

    const results = data.web.results.map((result: BraveSearchResult) => ({
      title: result.title,
      description: result.description,
      extra_snippets: result.extra_snippets,
      url: result.url,
    }));

    // Create Response Object
    const response_body = {
      'application/json': {
        body: `<search_results>${JSON.stringify(results)}</search_results>`,
      },
    };
    const action_response = {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: 200,
      responseBody: response_body,
    };
    const api_response = {
      messageVersion: '1.0',
      response: action_response,
    };

    return api_response;
  } catch (error: unknown) {
    console.log(error);
    const action_response = {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: 500,
      responseBody: {
        'application/json': {
          body: 'Internal Server Error',
        },
      },
    };
    const api_response = {
      messageVersion: '1.0',
      response: action_response,
    };
    return api_response;
  }
};
