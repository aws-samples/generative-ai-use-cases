import { PreSignUpTriggerEvent, Context, Callback } from 'aws-lambda';

const ALLOWED_SIGN_UP_EMAIL_DOMAINS_STR =
  process.env.ALLOWED_SIGN_UP_EMAIL_DOMAINS_STR;
const ALLOWED_SIGN_UP_EMAIL_DOMAINS: string[] = JSON.parse(
  ALLOWED_SIGN_UP_EMAIL_DOMAINS_STR!
);

// Determine if the email domain is allowed
const checkEmailDomain = (email: string): boolean => {
  // If the number of @ in the email address is not one, always allow it
  if (email.split('@').length !== 2) {
    return false;
  }

  // If the domain part of the email address matches any of the allowed domains, allow it
  // Otherwise, do not allow it
  // (If ALLOWED_SIGN_UP_EMAIL_DOMAINS is empty, always allow it)
  const domain = email.split('@')[1];
  return ALLOWED_SIGN_UP_EMAIL_DOMAINS.includes(domain);
};

/**
 * Cognito Pre Sign-up Lambda Trigger.
 *
 * @param event - The event from Cognito.
 * @param context - The Lambda execution context.
 * @param callback - The callback function to return data or error.
 */
exports.handler = async (
  event: PreSignUpTriggerEvent,
  context: Context,
  callback: Callback
) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const isAllowed = checkEmailDomain(event.request.userAttributes.email);
    if (isAllowed) {
      // If successful, return the event object as is
      callback(null, event);
    } else {
      // If failed, return an error message
      callback(new Error('Invalid email domain'));
    }
  } catch (error) {
    console.log('Error ocurred:', error);
    // Check if the error is an instance of Error and return an appropriate error message
    if (error instanceof Error) {
      callback(error);
    } else {
      // If the error is not an instance of Error, return a general error message
      callback(new Error('An unknown error occurred.'));
    }
  }
};
