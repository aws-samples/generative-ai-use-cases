import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getTenantContext } from './utils/tenantAuth';
import { initTenantBedrockRuntimeClient } from './utils/bedrockClientTenant';
import {
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Get tenant context from the request
    const tenantContext = await getTenantContext(event);
    
    if (!tenantContext.credentials) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Failed to obtain tenant credentials' }),
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { prompt, modelId, maxTokens = 1000 } = body;

    if (!prompt || !modelId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required parameters: prompt and modelId' }),
      };
    }

    // Initialize Bedrock client with tenant credentials
    const bedrockClient = await initTenantBedrockRuntimeClient(
      { region: process.env.AWS_REGION || 'us-east-1' },
      tenantContext.tenantId,
      tenantContext.credentials
    );

    // Prepare the request for the model
    const requestBody = {
      prompt,
      max_tokens_to_sample: maxTokens,
      temperature: 0.7,
      top_p: 0.9,
    };

    // Add tenant ID as a tag for tracking
    const invokeModelInput: InvokeModelCommandInput = {
      modelId,
      body: JSON.stringify(requestBody),
      contentType: 'application/json',
      accept: 'application/json',
    };

    // Invoke the model with tenant-scoped permissions
    const command = new InvokeModelCommand(invokeModelInput);
    const response = await bedrockClient.send(command);

    // Parse the response
    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body)
    );

    // Log usage for tenant tracking
    console.log({
      tenantId: tenantContext.tenantId,
      modelId,
      inputTokens: responseBody.usage?.input_tokens || 0,
      outputTokens: responseBody.usage?.output_tokens || 0,
      timestamp: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantContext.tenantId,
      },
      body: JSON.stringify({
        completion: responseBody.completion || responseBody.content,
        usage: responseBody.usage,
        tenantId: tenantContext.tenantId,
      }),
    };
  } catch (error) {
    console.error('Error in predict handler:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Tenant ID not found')) {
        return {
          statusCode: 401,
          body: JSON.stringify({ message: 'Unauthorized: Tenant ID not found' }),
        };
      }
      
      if (error.message.includes('Failed to assume role')) {
        return {
          statusCode: 403,
          body: JSON.stringify({ message: 'Forbidden: Unable to access tenant resources' }),
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};