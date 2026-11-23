// Set when the runtimes were built with a JWT authorizer. The runtime then
// sees a token the service has already validated, so the user it names cannot
// be chosen by the caller — unlike the user_id in the payload, which is
// whatever the browser wrote.
const jwtAuth = import.meta.env.VITE_APP_AGENT_CORE_JWT_AUTH === 'true';

// Only the runtimes this deployment builds get the JWT authorizer. The
// research agent and external runtimes keep IAM, so they are still signed.
const runtimeArn = (value: string | undefined): string | undefined => {
  if (!value || value === 'null') return undefined;
  return (JSON.parse(value) as { arn?: string } | null)?.arn;
};
const tokenGuardedRuntimeArns = new Set(
  [
    runtimeArn(import.meta.env.VITE_APP_AGENT_CORE_GENERIC_RUNTIME),
    runtimeArn(import.meta.env.VITE_APP_AGENT_CORE_AGENT_BUILDER_RUNTIME),
  ].filter((arn): arn is string => !!arn)
);

/** Whether a runtime is called with the user's token instead of a signature. */
export const invokesWithToken = (arn: string | undefined): boolean =>
  jwtAuth && !!arn && tokenGuardedRuntimeArns.has(arn);
