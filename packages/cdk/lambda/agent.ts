import {
  AgentInput,
  AgentOutput,
  BraveSearchResult,
  TavilySearchResult,
} from 'generative-ai-use-cases';
import { StackInput } from '../lib/stack-input';

type SearchResult = {
  title: string;
  content: string;
  url: string;
  extraSnippets?: string[];
};

const searchUsingBrave = async (keyword: string): Promise<SearchResult[]> => {
  // https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
  const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${keyword}&count=3&text_decorations=0`;
  const searchApiKey = process.env.SEARCH_API_KEY || '';
  const response = await fetch(searchUrl, {
    headers: {
      'X-Subscription-Token': searchApiKey,
    },
  });
  const data = await response.json();
  console.log(JSON.stringify(data));

  return data.web.results.map(
    (result: BraveSearchResult): SearchResult => ({
      title: result.title,
      content: result.description,
      url: result.url,
      extraSnippets: result.extra_snippets,
    })
  );
};

const searchUsingTavily = async (keyword: string): Promise<SearchResult[]> => {
  const searchUrl = 'https://api.tavily.com/search';
  const searchApiKey = process.env.SEARCH_API_KEY || '';

  // https://docs.tavily.com/documentation/api-reference/endpoint/search
  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${searchApiKey}`,
    },
    body: JSON.stringify({
      query: keyword,
      search_depth: 'basic',
      include_answer: false,
      include_images: false,
      include_raw_content: true,
      max_results: 3,
    }),
  });

  const data = await response.json();
  console.log(JSON.stringify(data));

  return data.results.map((result: TavilySearchResult) => ({
    title: result.title,
    content: result.raw_content ?? result.content,
    url: result.url,
  }));
};

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

    const searchEngine = process.env
      .SEARCH_ENGINE as StackInput['searchEngine'];

    const results =
      searchEngine === 'Brave'
        ? await searchUsingBrave(keyword)
        : await searchUsingTavily(keyword);

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
