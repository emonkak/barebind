import { sequentialEqual } from './compare.js';
import { Literal, type TemplateLiteral } from './internal.js';

interface ExpandedResult {
  expandedStrings: readonly string[];
  literalValues: readonly string[];
  literalPositions: readonly number[];
}

export class TemplateLiteralPreprocessor {
  private readonly _expandedResults: WeakMap<
    TemplateStringsArray,
    ExpandedResult[]
  > = new WeakMap();

  process<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T> {
    const literalValues: string[] = [];
    const literalPositions: number[] = [];
    const nonLiteralValues: T[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i]!;
      if (value instanceof Literal) {
        literalValues.push(value.valueOf());
        literalPositions.push(i);
      } else {
        nonLiteralValues.push(value);
      }
    }

    let expandedResults = this._expandedResults.get(strings);

    if (expandedResults !== undefined) {
      for (let i = 0, l = expandedResults.length; i < l; i++) {
        const expandedResult = expandedResults[i]!;

        if (
          sequentialEqual(expandedResult.literalValues, literalValues) &&
          sequentialEqual(expandedResult.literalPositions, literalPositions)
        ) {
          return {
            strings: expandedResult.expandedStrings,
            values: nonLiteralValues,
          };
        }
      }
    } else {
      expandedResults = [];
      this._expandedResults.set(strings, expandedResults);
    }

    const expandedStrings =
      literalValues.length > 0 ? expandLiterals(strings, values) : strings;

    expandedResults.push({
      expandedStrings,
      literalValues,
      literalPositions,
    });

    return {
      strings: expandedStrings,
      values: nonLiteralValues,
    };
  }
}

function expandLiterals<T>(
  strings: readonly string[],
  values: readonly (T | Literal)[],
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
