import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../lambda/getWebText';

// Mock the DNS lookup function
jest.mock('util', () => ({
  promisify: jest.fn().mockImplementation(() => {
    return (hostname: string) => {
      if (hostname.includes('example-internal.com')) {
        return Promise.resolve({ address: '192.168.1.1', family: 4 });
      }
      if (hostname.includes('non-existent-domain.com')) {
        return Promise.reject(new Error('DNS resolution failed'));
      }
      return Promise.resolve({ address: '8.8.8.8', family: 4 });
    };
  }),
}));

// Helper function to create APIGatewayProxyEvent
function createAPIGatewayProxyEvent(url?: string): APIGatewayProxyEvent {
  return {
    queryStringParameters: url ? { url } : undefined,
  } as unknown as APIGatewayProxyEvent;
}

// Mock global fetch
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    text: () =>
      Promise.resolve(
        '<html><body><h1>Test Title</h1><p>Test content</p></body></html>'
      ),
  })
);

describe('getWebText Lambda handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test for successful request with valid URL
  test('returns correct response for valid URL request', async () => {
    // Mock HTML content response
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        text: () =>
          Promise.resolve(
            '<html><body><h1>Test Title</h1><p>Test content</p></body></html>'
          ),
      })
    );

    // Execute test
    const result = await handler(
      createAPIGatewayProxyEvent('https://example.com')
    );

    // Verify results
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty('text');
    expect(JSON.parse(result.body).text).toContain('Test Title');
    expect(JSON.parse(result.body).text).toContain('Test content');
    expect(global.fetch).toHaveBeenCalledWith('https://example.com');
  });

  // Test for missing URL parameter
  test('returns 400 error when URL parameter is missing', async () => {
    // Execute test
    const result = await handler(createAPIGatewayProxyEvent());

    // Verify results
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'url is missing',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Test for invalid URL scheme
  test('returns 403 error when URL scheme is not http or https', async () => {
    // Execute test
    const result = await handler(
      createAPIGatewayProxyEvent('ftp://example.com')
    );

    // Verify results
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Unauthorized URL scheme. Only HTTP or HTTPS is allowed.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Test for private IP address access
  test('returns 403 error when trying to access private IP address', async () => {
    // Execute test
    const result = await handler(
      createAPIGatewayProxyEvent('http://192.168.1.1')
    );

    // Verify results
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Access to internal networks is not allowed.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Test for localhost access
  test('returns 403 error when trying to access localhost', async () => {
    // Execute test
    const result = await handler(
      createAPIGatewayProxyEvent('http://localhost')
    );

    // Verify results
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Access to internal networks is not allowed.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Test for domain resolving to private IP
  test('returns 403 error when domain resolves to private IP', async () => {
    // Execute test - the util.promisify mock handles giving us a private IP
    const result = await handler(
      createAPIGatewayProxyEvent('http://example-internal.com')
    );

    // Verify results
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message:
        'Access to domains resolving to internal networks is not allowed.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Test for DNS lookup error
  test('returns 403 error when DNS lookup fails', async () => {
    // Mock console.error to prevent actual logging during test
    const originalConsoleError = console.error;
    console.error = jest.fn();

    // Execute test - the util.promisify mock will throw an error
    const result = await handler(
      createAPIGatewayProxyEvent('http://non-existent-domain.com')
    );

    // Restore console.error
    console.error = originalConsoleError;

    // Verify results
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Failed to resolve the specified domain.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Test for fetch error
  test('returns 500 error when fetch fails', async () => {
    // Mock fetch to throw an error
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error('Network error'))
    );

    // Mock console.log to prevent actual logging during test
    const originalConsoleLog = console.log;
    console.log = jest.fn();

    // Execute test
    const result = await handler(
      createAPIGatewayProxyEvent('https://example.com')
    );

    // Restore console.log
    console.log = originalConsoleLog;

    // Verify results
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal Server Error',
    });
  });

  // Test for malformed URL
  test('returns 403 error when URL is malformed', async () => {
    // Mock console.error to prevent actual logging during test
    const originalConsoleError = console.error;
    console.error = jest.fn();

    // Execute test
    const result = await handler(createAPIGatewayProxyEvent('not-a-valid-url'));

    // Restore console.error
    console.error = originalConsoleError;

    // Verify results
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Invalid URL format.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
