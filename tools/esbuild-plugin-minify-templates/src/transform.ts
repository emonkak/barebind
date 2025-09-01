import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import * as astring from 'astring';

const VOID_WHITESPACE_PATTERN = /(?<=[<>])\r?\n\s*|\r?\n\s*(?=[<>])/g;
const WHITESPACE_PATTERN = /\r?\n\s*/g;

export function transformTemplates(input: string, tagNames: string[]): string {
  const ast = acorn.parse(input, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });

  let modified = false;

  walk.simple(ast, {
    TaggedTemplateExpression(node) {
      const { tag, quasi } = node;
      const tagName = getIdentifierName(tag);

      if (tagNames.includes(tagName)) {
        quasi.quasis = quasi.quasis.map((element) => {
          const raw = element.value.raw
            .replace(VOID_WHITESPACE_PATTERN, '')
            .replace(WHITESPACE_PATTERN, ' ');

          return {
            ...element,
            value: {
              raw,
            },
          };
        });
        modified = true;
      }
    },
  });

  return modified ? astring.generate(ast) : input;
}

function getIdentifierName(expression: acorn.Expression): string {
  switch (expression.type) {
    case 'Identifier':
      return expression.name;
    case 'MemberExpression': {
      const { property } = expression;
      return property.type === 'PrivateIdentifier'
        ? property.name
        : getIdentifierName(property);
    }
    case 'ParenthesizedExpression':
      return getIdentifierName(expression.expression);
  }
  return '';
}
