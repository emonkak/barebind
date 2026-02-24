import { sequentialEqual } from '../compare.js';
import type { RenderContext } from '../internal.js';

const stringInterpolationCache = new WeakMap<
  readonly string[],
  StringInterpolation[]
>();

interface StringInterpolation {
  interpolatedStrings: readonly string[];
  literalStrings: readonly string[];
  literalPositions: readonly number[];
}

export class PartialTemplate {
  readonly strings: readonly string[];

  readonly values: readonly unknown[];

  static parse(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): PartialTemplate {
    const literalStrings: string[] = [];
    const literalPositions: number[] = [];
    const flattenedValues: unknown[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i]!;
      if (value instanceof PartialTemplate) {
        literalStrings.push(...value.strings);
        literalPositions.push(i);
        flattenedValues.push(...value.values);
      } else {
        flattenedValues.push(value);
      }
    }

    if (literalStrings.length === 0) {
      return new PartialTemplate(strings, values);
    }

    let stringInterpolations = stringInterpolationCache.get(strings);

    if (stringInterpolations !== undefined) {
      for (const stringInterpolation of stringInterpolations) {
        if (
          sequentialEqual(stringInterpolation.literalStrings, literalStrings) &&
          sequentialEqual(
            stringInterpolation.literalPositions,
            literalPositions,
          )
        ) {
          return new PartialTemplate(
            stringInterpolation.interpolatedStrings,
            flattenedValues,
          );
        }
      }
    } else {
      stringInterpolations = [];
      stringInterpolationCache.set(strings, stringInterpolations);
    }

    const interpolatedStrings = interpolateStrings(strings, values);

    stringInterpolations.push({
      interpolatedStrings,
      literalStrings,
      literalPositions,
    });

    return new PartialTemplate(interpolatedStrings, flattenedValues);
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

export type PartialTemplateContext = Pick<
  RenderContext,
  'html' | 'math' | 'svg'
>;

export function PartialTemplateContext(
  context: RenderContext,
): PartialTemplateContext {
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

function interpolateStrings(
  strings: readonly string[],
  values: readonly unknown[],
): readonly string[] {
  const interpolatedStrings = [strings[0]!];
  let interpolatedIndex = 0;

  for (let i = 0, l = values.length; i < l; i++) {
    const value = values[i];
    if (value instanceof PartialTemplate) {
      interpolatedStrings[interpolatedIndex] += value.strings[0]!;
      for (let j = 0, m = value.values.length; j < m; j++) {
        interpolatedStrings.push(value.strings[j + 1]!);
        interpolatedIndex++;
      }
      interpolatedStrings[interpolatedIndex] += strings[i + 1]!;
    } else {
      interpolatedStrings.push(strings[i + 1]!);
      interpolatedIndex++;
    }
  }

  return interpolatedStrings;
}
