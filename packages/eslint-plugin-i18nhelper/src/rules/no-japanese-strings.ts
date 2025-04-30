import { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { includeJa } from '../utils';

export const noJpString: TSESLint.RuleModule<'noJpString', []> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect Japanese strings',
      recommended: 'recommended',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noJpString: 'Japanese string detected: "{{value}}"',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Literal(node: TSESTree.Literal) {
        if (typeof node.value === 'string' && includeJa(node.value)) {
          context.report({
            node,
            messageId: 'noJpString',
            data: {
              value: node.value,
            },
          });
        }
      },
      TemplateLiteral(node: TSESTree.TemplateLiteral) {
        node.quasis.forEach((quasi) => {
          if (
            quasi.value &&
            typeof quasi.value.cooked === 'string' &&
            includeJa(quasi.value.cooked)
          ) {
            context.report({
              node: quasi,
              messageId: 'noJpString',
              data: {
                value: quasi.value.cooked,
              },
            });
          }
        });
      },
    };
  },
};
