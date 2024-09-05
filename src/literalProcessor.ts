import { type FilterLiterals, Literal } from './baseTypes.js';
import { sequentialEqual } from './compare.js';

export class LiteralProcessor {
  private readonly _templateCaches: WeakMap<
    TemplateStringsArray,
    {
      strings: readonly string[];
      literals: readonly string[];
      literalPositions: readonly number[];
    }
  > = new WeakMap();

  process<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    values: TValues,
  ): {
    strings: readonly string[];
    values: FilterLiterals<TValues>;
  } {
    const literals: string[] = [];
    const literalPositions: number[] = [];
    const staticValues: unknown[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i];
      if (value instanceof Literal) {
        literals.push(value.toString());
        literalPositions.push(i);
      } else {
        staticValues.push(value);
      }
    }

    const templateCache = this._templateCaches.get(strings);

    if (
      templateCache !== undefined &&
      sequentialEqual(templateCache.literals, literals) &&
      sequentialEqual(templateCache.literalPositions, literalPositions)
    ) {
      return {
        strings: templateCache.strings,
        values: staticValues as FilterLiterals<TValues>,
      };
    }

    const staticStrings =
      literals.length > 0 ? applyLiterals(strings, values) : strings;

    this._templateCaches.set(strings, {
      strings: staticStrings,
      literals,
      literalPositions,
    });

    return {
      strings: staticStrings,
      values: staticValues as FilterLiterals<TValues>,
    };
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
