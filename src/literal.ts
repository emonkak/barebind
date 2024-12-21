import { sequentialEqual } from './compare.js';

export type NonLiteralValues<TValues extends readonly any[]> =
  TValues extends readonly [infer THead, ...infer TTail]
    ? THead extends Literal
      ? NonLiteralValues<TTail>
      : [THead, ...NonLiteralValues<TTail>]
    : [];

interface StaticTemplate {
  strings: readonly string[];
  literalStrings: readonly string[];
  literalPositions: readonly number[];
}

export class LiteralProcessor {
  private readonly _staticTemplates: WeakMap<
    TemplateStringsArray,
    StaticTemplate
  > = new WeakMap();

  process<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    values: TValues,
  ): {
    strings: readonly string[];
    values: NonLiteralValues<TValues>;
  } {
    const literalStrings: string[] = [];
    const literalPositions: number[] = [];
    const nonLiteralValues: unknown[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i];
      if (value instanceof Literal) {
        literalStrings.push(value.valueOf());
        literalPositions.push(i);
      } else {
        nonLiteralValues.push(value);
      }
    }

    const staticTemplate = this._staticTemplates.get(strings);

    if (
      staticTemplate !== undefined &&
      sequentialEqual(staticTemplate.literalStrings, literalStrings) &&
      sequentialEqual(staticTemplate.literalPositions, literalPositions)
    ) {
      return {
        strings: staticTemplate.strings,
        values: nonLiteralValues as NonLiteralValues<TValues>,
      };
    }

    const staticStrings =
      literalStrings.length > 0 ? applyLiterals(strings, values) : strings;

    this._staticTemplates.set(strings, {
      strings: staticStrings,
      literalStrings,
      literalPositions,
    });

    return {
      strings: staticStrings,
      values: nonLiteralValues as NonLiteralValues<TValues>,
    };
  }
}

export class Literal {
  readonly #string: string;

  constructor(string: string) {
    this.#string = string;
  }

  toString(): string {
    return this.#string;
  }

  valueOf(): string {
    return this.#string;
  }
}

function applyLiterals(
  strings: readonly string[],
  values: readonly unknown[],
): readonly string[] {
  const staticStrings = [strings[0]!];

  for (let i = 0, j = 0, l = values.length; i < l; i++) {
    const value = values[i];
    if (value instanceof Literal) {
      staticStrings[j] += value + strings[i + 1]!;
    } else {
      staticStrings.push(strings[i + 1]!);
      j++;
    }
  }

  return staticStrings;
}
