import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { parse } from 'node-html-parser';
import sanitizeHtml from 'sanitize-html';
import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// Function to check if an IP address is a private IP
function isPrivateIP(ip: string): boolean {
  // Function to convert an IP address to a numeric value
  const ipToLong = (ip: string) => {
    return (
      ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>>
      0
    );
  };

  // Define blocked IP address ranges
  const blockedRanges = [
    // Loopback addresses
    { start: '127.0.0.0', end: '127.255.255.255' },
    // Link-local addresses
    { start: '169.254.0.0', end: '169.254.255.255' },
    // Private network addresses
    { start: '10.0.0.0', end: '10.255.255.255' },
    { start: '172.16.0.0', end: '172.31.255.255' },
    { start: '192.168.0.0', end: '192.168.255.255' },
    // AWS metadata service specific address
    { start: '169.254.169.254', end: '169.254.169.254' },
    // localhost
    { start: '0.0.0.0', end: '0.255.255.255' },
  ];

  const ipLong = ipToLong(ip);

  // Check if IP is within any of the blocked ranges
  return blockedRanges.some((range) => {
    const startLong = ipToLong(range.start);
    const endLong = ipToLong(range.end);
    return ipLong >= startLong && ipLong <= endLong;
  });
}

// Function to validate URL safety
async function validateUrl(
  urlString: string
): Promise<{ valid: boolean; message?: string }> {
  try {
    // Check URL format
    const url = new URL(urlString);

    // Only http and https schemes are allowed
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        valid: false,
        message: 'Unauthorized URL scheme. Only HTTP or HTTPS is allowed.',
      };
    }

    // Validate if IP address is directly specified
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (ipv4Regex.test(url.hostname)) {
      if (isPrivateIP(url.hostname)) {
        return {
          valid: false,
          message: 'Access to internal networks is not allowed.',
        };
      }
    } else {
      // For domain names, perform DNS lookup to check the resolved IP
      try {
        const { address } = await dnsLookup(url.hostname);
        if (isPrivateIP(address)) {
          return {
            valid: false,
            message:
              'Access to domains resolving to internal networks is not allowed.',
          };
        }
      } catch (error) {
        console.error(`DNS lookup error: ${error}`);
        return {
          valid: false,
          message: 'Failed to resolve the specified domain.',
        };
      }
    }

    // Block localhost-related hostnames (to handle cases bypassing DNS resolution)
    const blockedHostnames = ['localhost', '127.0.0.1', 'loopback', 'internal'];
    const hostname = url.hostname.toLowerCase();
    if (blockedHostnames.some((blocked) => hostname.includes(blocked))) {
      return {
        valid: false,
        message: 'Access to internal networks is not allowed.',
      };
    }

    return { valid: true };
  } catch (error) {
    console.error(`URL validation error: ${error}`);
    return { valid: false, message: 'Invalid URL format.' };
  }
}

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

    // Validate URL safety
    const validation = await validateUrl(url);
    if (!validation.valid) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: validation.message || 'Access denied',
        }),
      };
    }

    // Execute request if URL is confirmed safe
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
