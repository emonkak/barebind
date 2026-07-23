import * as swc from '@swc/core';
import type * as esbuild from 'esbuild';

const VOID_WHITESPACE_PATTERN = /(?<=[<>])\r?\n\s*|\r?\n\s*(?=[<>])/g;
const WHITESPACE_PATTERN = /\r?\n\s*/g;

export async function transformTemplates(
  input: string,
  loader: esbuild.Loader,
  tagNames: string[],
): Promise<string> {
  const module = await swc.parse(input, {
    syntax: loader.startsWith('ts') ? 'typescript' : 'ecmascript',
    jsx: loader === 'jsx',
    tsx: loader === 'tsx',
  });
  const expressions: swc.TaggedTemplateExpression[] = [];

  for (const node of module.body) {
    collectTaggedTemplateExpressions(node, tagNames, expressions);
  }

  if (expressions.length === 0) {
    return input;
  }

  for (const expression of expressions) {
    for (const quasi of expression.template.quasis) {
      quasi.raw = quasi.raw
        .replace(VOID_WHITESPACE_PATTERN, '')
        .replace(WHITESPACE_PATTERN, ' ');
    }
  }

  const output = await swc.print(module);

  return output.code;
}

function collectTaggedTemplateExpressions(
  node: unknown,
  tagNames: string[],
  expressions: swc.TaggedTemplateExpression[],
): void {
  if (isTaggedTemplateExpression(node)) {
    const name = getIdentifierName(node.tag);
    if (tagNames.includes(name)) {
      expressions.push(node);
    }
  }

  if (isObject(node)) {
    for (const key of Object.keys(node)) {
      if (shouldIgnoreProperty(key)) {
        continue;
      }
      const value = (node as any)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          collectTaggedTemplateExpressions(item, tagNames, expressions);
        }
      } else {
        collectTaggedTemplateExpressions(value, tagNames, expressions);
      }
    }
  }
}

function getIdentifierName(expression: swc.Expression): string {
  switch (expression.type) {
    case 'Identifier':
      return expression.value;
    case 'MemberExpression': {
      const property = expression.property;
      switch (property.type) {
        case 'Identifier':
          return property.value;
      }
    }
  }
  return '';
}

function isObject(value: any): value is object {
  return value !== null && typeof value === 'object';
}

function isTaggedTemplateExpression(
  value: any,
): value is swc.TaggedTemplateExpression {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.type === 'TaggedTemplateExpression'
  );
}

function shouldIgnoreProperty(key: string): boolean {
  switch (key) {
    case 'span':
    case 'type':
      return true;
    default:
      return false;
  }
}
