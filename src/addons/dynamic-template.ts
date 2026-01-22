import { sequentialEqual } from '../compare.js';
import type { HookFunction, RenderContext } from '../internal.js';

const preprocessedTemplateCache = new WeakMap<
  readonly string[],
  PreprocessedTemplate[]
>();

export interface DynamicTemplateContext
  extends Pick<RenderContext, 'html' | 'math' | 'svg'> {
  literal(value: string): String;
}

interface PreprocessedTemplate {
  expandedStrings: readonly string[];
  literalValues: readonly string[];
  literalPositions: readonly number[];
}

export function DynamicTemplate(): HookFunction<DynamicTemplateContext> {
  return (context) => {
    return {
      html: (strings, ...binds) =>
        context.html(...preprocessTemplate(strings, binds)),
      math: (strings, ...binds) =>
        context.math(...preprocessTemplate(strings, binds)),
      svg: (strings, ...binds) =>
        context.svg(...preprocessTemplate(strings, binds)),
      literal: (value) => new Literal(value),
    };
  };
}

/**
 * @internal
 */
export class Literal extends String {}

/**
 * @internal
 */
export function preprocessTemplate(
  strings: readonly string[],
  values: readonly unknown[],
): [readonly string[], ...unknown[]] {
  const literalValues: string[] = [];
  const literalPositions: number[] = [];
  const nonLiteralValues: unknown[] = [];

  for (let i = 0, l = values.length; i < l; i++) {
    const value = values[i]!;
    if (value instanceof Literal) {
      literalValues.push(value.valueOf());
      literalPositions.push(i);
    } else {
      nonLiteralValues.push(value);
    }
  }

  let preprocessedTemplates = preprocessedTemplateCache.get(strings);

  if (preprocessedTemplates !== undefined) {
    for (const preprocessedTemplate of preprocessedTemplates) {
      if (
        sequentialEqual(preprocessedTemplate.literalValues, literalValues) &&
        sequentialEqual(preprocessedTemplate.literalPositions, literalPositions)
      ) {
        return [preprocessedTemplate.expandedStrings, ...nonLiteralValues];
      }
    }
  } else {
    preprocessedTemplates = [];
    preprocessedTemplateCache.set(strings, preprocessedTemplates);
  }

  const expandedStrings =
    literalValues.length > 0 ? expandLiterals(strings, values) : strings;

  preprocessedTemplates.push({
    expandedStrings,
    literalValues,
    literalPositions,
  });

  return [expandedStrings, ...nonLiteralValues];
}

function expandLiterals(
  strings: readonly string[],
  values: readonly unknown[],
): readonly string[] {
  const expandedStrings = [strings[0]!];

  for (let i = 0, j = 0, l = values.length; i < l; i++) {
    const value = values[i];
    if (value instanceof Literal) {
      expandedStrings[j] += value + strings[i + 1]!;
    } else {
      expandedStrings.push(strings[i + 1]!);
      j++;
    }
  }

  return expandedStrings;
}
