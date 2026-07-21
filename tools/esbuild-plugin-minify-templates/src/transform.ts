import { tsPlugin } from '@sveltejs/acorn-typescript';
import * as acorn from 'acorn';

const tsParser = acorn.Parser.extend(tsPlugin());

const VOID_WHITESPACE_PATTERN = /(?<=[<>])\r?\n\s*|\r?\n\s*(?=[<>])/g;
const WHITESPACE_PATTERN = /\r?\n\s*/g;

export function transformTemplates(input: string, tagNames: string[]): string {
  const ast = tsParser.parse(input, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
  });

  const expressions: acorn.TaggedTemplateExpression[] = [];

  for (const node of ast.body) {
    collectTaggedTemplateExpressions(node, tagNames, expressions);
  }

  if (expressions.length === 0) {
    return input;
  }

  // Collect replacements in reverse order to preserve positions.
  const replacements: {
    start: number;
    end: number;
    body: string;
  }[] = [];

  for (const expression of expressions) {
    for (const quasi of expression.quasi.quasis) {
      const original = input.slice(quasi.start, quasi.end);
      const replaced = original
        .replace(VOID_WHITESPACE_PATTERN, '')
        .replace(WHITESPACE_PATTERN, ' ');
      if (original !== replaced) {
        replacements.push({
          start: quasi.start,
          end: quasi.end,
          body: replaced,
        });
      }
    }
  }

  // Apply from end to start so earlier positions remain valid.
  return replacements
    .sort((a, b) => b.start - a.start)
    .reduce(
      (output, replacement) =>
        output.slice(0, replacement.start) +
        replacement.body +
        output.slice(replacement.end),
      input,
    );
}

function collectTaggedTemplateExpressions(
  node: acorn.AnyNode,
  tagNames: string[],
  expressions: acorn.TaggedTemplateExpression[],
): void {
  if (node.type === 'TaggedTemplateExpression') {
    const name = getIdentifierName(node.tag);
    if (tagNames.includes(name)) {
      expressions.push(node);
    }
  }

  for (const key of Object.keys(node)) {
    if (shouldIgnoreProperty(key)) {
      continue;
    }
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          collectTaggedTemplateExpressions(item, tagNames, expressions);
        }
      }
    } else if (isNode(value)) {
      collectTaggedTemplateExpressions(value, tagNames, expressions);
    }
  }
}

function getIdentifierName(expression: {
  type: string;
  name?: string;
  property?: { type: string; name?: string };
}): string {
  switch (expression.type) {
    case 'Identifier':
      return expression.name ?? '';
    case 'MemberExpression': {
      const property = (
        expression as { property: { type: string; name?: string } }
      ).property;
      return property.type === 'PrivateIdentifier'
        ? (property.name ?? '')
        : getIdentifierName(property);
    }
  }
  return '';
}

function isNode(value: any): value is acorn.AnyNode {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.start === 'number' &&
    typeof value.end === 'number' &&
    typeof value.type === 'string'
  );
}

function shouldIgnoreProperty(key: string): boolean {
  switch (key) {
    case 'start':
    case 'end':
    case 'type':
    case 'range':
    case 'loc':
      return true;
    default:
      return false;
  }
}
