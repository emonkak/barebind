import { type FilterLiterals, Literal } from './baseTypes.js';
import { sequentialEqual } from './compare.js';

export class LiteralProcessor {
  private readonly _templateCaches: WeakMap<
    TemplateStringsArray,
    {
      strings: readonly string[];
      staticValues: readonly string[];
      staticPositions: readonly number[];
    }
  > = new WeakMap();

  process<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    values: TValues,
  ): {
    strings: readonly string[];
    values: FilterLiterals<TValues>;
  } {
    const staticValues: string[] = [];
    const staticPositions: number[] = [];
    const dynamicValues: unknown[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i];
      if (value instanceof Literal) {
        staticValues.push(value.toString());
        staticPositions.push(i);
      } else {
        dynamicValues.push(value);
      }
    }

    const templateCache = this._templateCaches.get(strings);

    if (
      templateCache !== undefined &&
      sequentialEqual(templateCache.staticValues, staticValues) &&
      sequentialEqual(templateCache.staticPositions, staticPositions)
    ) {
      return {
        strings: templateCache.strings,
        values: dynamicValues as FilterLiterals<TValues>,
      };
    }

    const staticStrings =
      staticValues.length > 0 ? applyLiterals(strings, values) : strings;

    this._templateCaches.set(strings, {
      strings: staticStrings,
      staticValues: staticValues,
      staticPositions: staticPositions,
    });

    return {
      strings: staticStrings,
      values: dynamicValues as FilterLiterals<TValues>,
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
