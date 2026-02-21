import { sequentialEqual } from '../compare.js';
import { $hook, type RenderContext } from '../internal.js';

const templateCacheMap = new WeakMap<readonly string[], TemplateCache[]>();

interface TemplateCache {
  expandedStrings: readonly string[];
  literalStrings: readonly string[];
  literalPositions: readonly number[];
}

export type PartialTemplateContext = Pick<
  RenderContext,
  'html' | 'math' | 'svg'
>;

export class PartialTemplate {
  readonly strings: readonly string[];

  readonly values: readonly unknown[];

  static [$hook](context: RenderContext): PartialTemplateContext {
    return {
      html(strings, ...values) {
        const template = PartialTemplate.parse(strings, ...values);
        return context.html(template.strings, ...template.values);
      },
      math(strings, ...values) {
        const template = PartialTemplate.parse(strings, ...values);
        return context.math(template.strings, ...template.values);
      },
      svg(strings, ...values) {
        const template = PartialTemplate.parse(strings, ...values);
        return context.svg(template.strings, ...template.values);
      },
    };
  }

  static parse(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): PartialTemplate {
    const literalStrings: string[] = [];
    const literalPositions: number[] = [];
    const expandedValues: unknown[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i]!;
      if (value instanceof PartialTemplate) {
        literalStrings.push(...value.strings);
        literalPositions.push(i);
        expandedValues.push(...value.values);
      } else {
        expandedValues.push(value);
      }
    }

    let templateCaches = templateCacheMap.get(strings);

    if (templateCaches !== undefined) {
      for (const templateCache of templateCaches) {
        if (
          sequentialEqual(templateCache.literalStrings, literalStrings) &&
          sequentialEqual(templateCache.literalPositions, literalPositions)
        ) {
          return new PartialTemplate(
            templateCache.expandedStrings,
            expandedValues,
          );
        }
      }
    } else {
      templateCaches = [];
      templateCacheMap.set(strings, templateCaches);
    }

    const expandedStrings =
      literalStrings.length > 0 ? expandStrings(strings, values) : strings;

    templateCaches.push({
      expandedStrings,
      literalStrings,
      literalPositions,
    });

    return new PartialTemplate(expandedStrings, expandedValues);
  }

  static literal(s: string): PartialTemplate {
    return new PartialTemplate([s], []);
  }

  private constructor(strings: readonly string[], values: readonly unknown[]) {
    this.strings = strings;
    this.values = values;

    DEBUG: {
      Object.freeze(this);
    }
  }

  toString(): string {
    return String.raw({ raw: this.strings }, ...this.values);
  }
}

function expandStrings(
  strings: readonly string[],
  values: readonly unknown[],
): readonly string[] {
  const expandedStrings = [strings[0]!];
  let lastStringIndex = 0;

  for (let i = 0, l = values.length; i < l; i++) {
    const value = values[i];
    if (value instanceof PartialTemplate) {
      expandedStrings[lastStringIndex] += value.strings[0]!;
      for (let j = 0, m = value.values.length; j < m; j++) {
        expandedStrings.push(value.strings[j + 1]!);
        lastStringIndex++;
      }
      expandedStrings[lastStringIndex] += strings[i + 1]!;
    } else {
      expandedStrings.push(strings[i + 1]!);
      lastStringIndex++;
    }
  }

  return expandedStrings;
}
