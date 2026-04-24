import { sequentialEqual } from './compare.js';
import {
  Bind,
  type TemplateMode,
  VNode,
  type VTemplate,
  wrap,
} from './core.js';

const INTERPOLATION_CACHE = new WeakMap<readonly string[], Interpolation[]>();

interface Interpolation {
  interpolatedStrings: readonly string[];
  literalStrings: readonly string[];
  literalPositions: readonly number[];
}

export class Partial {
  readonly strings: readonly string[];

  readonly values: readonly unknown[];

  static html(strings: readonly string[], ...children: unknown[]): VTemplate {
    const partial = Partial.parse(strings, ...children);
    return createTemplate('html', partial.strings, partial.values);
  }

  static literal(value: string): Partial {
    return new Partial([value], []);
  }

  static math(strings: readonly string[], ...children: unknown[]): VTemplate {
    const partial = Partial.parse(strings, ...children);
    return createTemplate('math', partial.strings, partial.values);
  }

  static parse(
    strings: readonly string[],
    ...values: readonly unknown[]
  ): Partial {
    const literalStrings: string[] = [];
    const literalPositions: number[] = [];
    const flattenedValues: unknown[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i]!;
      if (value instanceof Partial) {
        literalStrings.push(...value.strings);
        literalPositions.push(i);
        flattenedValues.push(...value.values);
      } else {
        flattenedValues.push(value);
      }
    }

    if (literalStrings.length === 0) {
      return new Partial(strings, values);
    }

    let interpolations = INTERPOLATION_CACHE.get(strings);

    if (interpolations !== undefined) {
      for (const interpolation of interpolations) {
        if (
          sequentialEqual(interpolation.literalStrings, literalStrings) &&
          sequentialEqual(interpolation.literalPositions, literalPositions)
        ) {
          return new Partial(
            interpolation.interpolatedStrings,
            flattenedValues,
          );
        }
      }
    } else {
      interpolations = [];
      INTERPOLATION_CACHE.set(strings, interpolations);
    }

    const interpolatedStrings = interpolatePartials(strings, values);

    interpolations.push({
      interpolatedStrings,
      literalStrings,
      literalPositions,
    });

    return new Partial(interpolatedStrings, flattenedValues);
  }

  static svg(strings: readonly string[], ...children: unknown[]): VTemplate {
    const partial = Partial.parse(strings, ...children);
    return createTemplate('svg', partial.strings, partial.values);
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

export function html(
  strings: readonly string[],
  ...children: unknown[]
): VTemplate {
  return createTemplate('html', strings, children);
}

export function math(
  strings: readonly string[],
  ...children: unknown[]
): VTemplate {
  return createTemplate('math', strings, children);
}

export function svg(
  strings: readonly string[],
  ...children: unknown[]
): VTemplate {
  return createTemplate('svg', strings, children);
}

export function text(
  strings: readonly string[],
  ...children: unknown[]
): VTemplate {
  return createTemplate('textarea', strings, children);
}

function createTemplate(
  mode: TemplateMode,
  strings: readonly string[],
  children: readonly unknown[],
): VTemplate {
  return new VNode(
    strings,
    {
      mode,
    },
    children.map((child, index) => new VNode(Bind, { index }, [wrap(child)])),
  );
}

function interpolatePartials(
  strings: readonly string[],
  values: readonly unknown[],
): readonly string[] {
  const interpolatedStrings = [strings[0]!];
  let interpolatedIndex = 0;

  for (let i = 0, l = values.length; i < l; i++) {
    const value = values[i];
    if (value instanceof Partial) {
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
