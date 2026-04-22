import { sequentialEqual } from './compare.js';
import { Bind, VNode, type VTemplate, wrap } from './core.js';

export const html = createTemplate('html');
export const svg = createTemplate('svg');
export const math = createTemplate('math');
export const text = createTemplate('textarea');

const stringInterpolationCache = new WeakMap<
  readonly string[],
  StringInterpolation[]
>();

interface StringInterpolation {
  interpolatedStrings: readonly string[];
  literalStrings: readonly string[];
  literalPositions: readonly number[];
}

export function createTemplate(
  mode: VTemplate['props']['mode'],
): (strings: readonly string[], ...children: unknown[]) => VTemplate {
  return (strings, ...children) =>
    new VNode(
      strings,
      {
        mode,
      },
      children.map((child, index) => new VNode(Bind, { index }, [wrap(child)])),
    );
}

export class Partial {
  readonly strings: readonly string[];

  readonly exprs: readonly unknown[];

  static html(strings: readonly string[], ...exprs: unknown[]): VTemplate {
    const template = Partial.parse(strings, ...exprs);
    return html(template.strings, ...template.exprs);
  }

  static literal(value: string): Partial {
    return new Partial([value], []);
  }

  static math(strings: readonly string[], ...exprs: unknown[]): VTemplate {
    const template = Partial.parse(strings, ...exprs);
    return math(template.strings, ...template.exprs);
  }

  static parse(
    strings: readonly string[],
    ...exprs: readonly unknown[]
  ): Partial {
    const literalStrings: string[] = [];
    const literalPositions: number[] = [];
    const flattenedExprs: unknown[] = [];

    for (let i = 0, l = exprs.length; i < l; i++) {
      const expr = exprs[i]!;
      if (expr instanceof Partial) {
        literalStrings.push(...expr.strings);
        literalPositions.push(i);
        flattenedExprs.push(...expr.exprs);
      } else {
        flattenedExprs.push(expr);
      }
    }

    if (literalStrings.length === 0) {
      return new Partial(strings, exprs);
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
          return new Partial(
            stringInterpolation.interpolatedStrings,
            flattenedExprs,
          );
        }
      }
    } else {
      stringInterpolations = [];
      stringInterpolationCache.set(strings, stringInterpolations);
    }

    const interpolatedStrings = interpolatePartials(strings, exprs);

    stringInterpolations.push({
      interpolatedStrings,
      literalStrings,
      literalPositions,
    });

    return new Partial(interpolatedStrings, flattenedExprs);
  }

  static svg(strings: readonly string[], ...exprs: unknown[]): VTemplate {
    const template = Partial.parse(strings, ...exprs);
    return svg(template.strings, ...template.exprs);
  }

  private constructor(strings: readonly string[], exprs: readonly unknown[]) {
    this.strings = strings;
    this.exprs = exprs;
  }

  toString(): string {
    return String.raw({ raw: this.strings }, ...this.exprs);
  }
}

function interpolatePartials(
  strings: readonly string[],
  exprs: readonly unknown[],
): readonly string[] {
  const interpolatedStrings = [strings[0]!];
  let interpolatedIndex = 0;

  for (let i = 0, l = exprs.length; i < l; i++) {
    const expr = exprs[i];
    if (expr instanceof Partial) {
      interpolatedStrings[interpolatedIndex] += expr.strings[0]!;
      for (let j = 0, m = expr.exprs.length; j < m; j++) {
        interpolatedStrings.push(expr.strings[j + 1]!);
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
