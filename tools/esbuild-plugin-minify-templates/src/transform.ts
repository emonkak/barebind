import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const VOID_WHITESPACE_PATTERN = /(?<=[<>])\r?\n\s*|\r?\n\s*(?=[<>])/g;
const WHITESPACE_PATTERN = /\r?\n\s*/g;

export function transformTemplates(input: string, tagNames: string[]): string {
  const ast = acorn.parse(input, {
    ecmaVersion: 2022,
    sourceType: 'module',
    locations: true,
  });

  const targets: acorn.TemplateLiteral[] = [];

  walk.simple(ast, {
    TaggedTemplateExpression(node) {
      const tagName = getIdentifierName(node.tag);

      if (tagNames.includes(tagName)) {
        const { quasi } = node;

        if (quasi.type === 'TemplateLiteral') {
          const transformedQuasis = quasi.quasis.map((element) => {
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

          targets.push({
            ...quasi,
            quasis: transformedQuasis,
          });
        }
      }
    },
  });

  let output = input;

  for (let i = targets.length - 1; i >= 0; i--) {
    const { start, end, quasis, expressions } = targets[i]!;
    const template = reconstructTemplateLiteral(quasis, expressions, input);
    output = output.slice(0, start) + template + output.slice(end);
  }

  return output;
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

function reconstructTemplateLiteral(
  quasis: acorn.TemplateElement[],
  expressions: acorn.Expression[],
  input: string,
) {
  let result = '`';
  for (let i = 0, l = quasis.length; i < l; i++) {
    const { raw } = quasis[i]!.value;
    result += raw;
    if (i < expressions.length) {
      const { start, end } = expressions[i]!;
      result += '${' + input.slice(start, end) + '}';
    }
  }
  result += '`';
  return result;
}
