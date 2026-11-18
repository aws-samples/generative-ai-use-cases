import { RequestMetadata } from 'generative-ai-use-cases';

// Tags GenU sets on Bedrock calls (`requestMetadata`). They land in the model
// invocation logs when the account has logging enabled, so usage can be
// grouped by user and use case in CloudWatch Logs Insights or Athena. The
// user is the Cognito `sub` (no email or other personal data).

/** Bedrock accepts a restricted character set; keep to the safe subset. */
const clean = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 256);

/** `/use-case-builder/execute/x` -> `use-case-builder`, `/chat` -> `chat`. */
const useCaseOf = (id: string | undefined): string =>
  clean((id ?? '').split('/').filter(Boolean)[0] ?? '');

export const bedrockRequestMetadata = (params: {
  userSub?: string;
  /** The request id the web client sends (the page path). */
  id?: string;
}): RequestMetadata => {
  const metadata: RequestMetadata = { genu: 'genu' };
  const user = clean(params.userSub ?? '');
  if (user) metadata.genu_user = user;
  const useCase = useCaseOf(params.id);
  if (useCase) metadata.genu_usecase = useCase;
  return metadata;
};
