import {
  MetadataAttributeSchema,
  RetrievalFilter,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { ExplicitFilterConfiguration } from 'generative-ai-use-cases';
import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';

/*
 * This file is used to define filters for the knowledge base. Feel free to uncomment the filters and customize them to suit your needs.
 *
 * Please refer to the metadata.json in the sample file (packages/cdk/rag-docs/docs) and define the document metadata accordingly.
 */

// Dynamic Filter
// Filter automatically applied by user attribute
// The filter automatically applied by the user attribute is defined here.
export const getDynamicFilters = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _idTokenPayload: CognitoIdTokenPayload
): RetrievalFilter[] => {
  const dynamicFilters: RetrievalFilter[] = [];

  // Example 1: Filter by cognito user group
  // Apply the filter by the Cognito user group

  // const groups = idTokenPayload['cognito:groups'];
  // if (!groups) throw new Error('cognito:groups is not set'); // If the group is not set, it will not be accessible and an error will be thrown
  // const groupFilter: RetrievalFilter = {
  //   in: {
  //     key: 'group',
  //     value: groups,
  //   },
  // };
  // dynamicFilters.push(groupFilter);

  // Example 2: Filter by SAML IdP group custom attribute (Check steps to setup attribute mapping in docs/SAML_WITH_ENTRA_ID.md)
  // Apply the filter by the SAML IdP group custom attribute
  // Please refer to docs/SAML_WITH_ENTRA_ID.md for the setup method of the custom attribute

  // const groups = (idTokenPayload['custom:idpGroup'] as string) // group is kept as a string (i.e. [group1id, group2id])
  //   .slice(1, -1) // Remove the first and last parentheses
  //   .split(/, ?/) // Split by comma and space
  //   .filter(Boolean); // Remove empty strings;
  // if (!groups) throw new Error('custom:idpGroup is not set'); // If the group is not set, it will not be accessible and an error will be thrown
  // const groupFilter: RetrievalFilter = {
  //   in: {
  //     key: 'group',
  //     value: groups,
  //   },
  // };
  // dynamicFilters.push(groupFilter);

  return dynamicFilters;
};

// Implicit Filter
// Parsed by AI, not shown to user (Claude Sonnet 3.5 is used and may cause throttling error)
// Apply filters automatically by AI based on the request (Claude Sonnet 3.5 is used. It may cause throttling error)
export const implicitFilters: MetadataAttributeSchema[] = [
  // Example 1: Filter by year
  // {
  //   key: 'year',
  //   type: 'NUMBER',
  //   description: 'Filter by year',
  // },
  // Customize Here
];

// Hidden Static Explicit Filter
// Filter not shown to user (i.e. application level permission, pool tenant)
// Define filters that are not shown to user (i.e. application level permission, pool tenant)
export const hiddenStaticExplicitFilters: RetrievalFilter[] = [
  // Example 1: Filter by data classification
  // {
  //   notIn: {
  //     key: 'classification',
  //     value: ['secret'],
  //   },
  // },
  // Example 2: Filter by tenant
  // {
  //   equals: {
  //     key: 'tenant',
  //     value: 'tenant1',
  //   },
  // },
  // Customize Here
];

// User Defined Explicit Filter
// Filter shown to user on application
// Define filters that user can select on the application
// The sample file (packages/cdk/rag-docs/docs) defines the metadata.json accordingly.
export const userDefinedExplicitFilters: ExplicitFilterConfiguration[] = [
  // Example 1: Filter by category (string match)
  {
    key: 'category',
    type: 'STRING',
    options: [{ value: 'AWS', label: 'AWS' }],
    description: 'Category',
  },

  // Example 2: Filter by tag (string list)
  {
    key: 'tag',
    type: 'STRING_LIST',
    options: [
      { value: 'AWS', label: 'AWS' },
      { value: 'Amazon Bedrock', label: 'Amazon Bedrock' },
      { value: 'Amazon SageMaker', label: 'Amazon SageMaker' },
    ],
    description: 'Tag',
  },

  // Example 3: Filter by year (number)
  {
    key: 'year',
    type: 'NUMBER',
    description: 'Year',
  },

  // Example 4: Filter by is_public (boolean)
  {
    key: 'is_public',
    type: 'BOOLEAN',
    options: [
      { value: 'true', label: 'Public' },
      { value: 'false', label: 'Private' },
    ],
    description: 'Public',
  },

  // Example 5: Filter by language (string match)
  {
    key: 'language',
    type: 'STRING',
    options: [
      { value: 'en', label: 'English' },
      { value: 'ja', label: 'Japanese' },
    ],
    description: 'Language',
  },

  // Customize Here
];
