import { sequentialEqual } from './compare.js';
import { Literal, type TemplateLiteral } from './internal.js';

interface ExpansionResult {
  expandedStrings: readonly string[];
  literalValues: readonly string[];
  literalPositions: readonly number[];
}

export class TemplateLiteralPreprocessor {
  private readonly _expansionResults: WeakMap<
    TemplateStringsArray,
    ExpansionResult[]
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

    let expansionResults = this._expansionResults.get(strings);

    if (expansionResults !== undefined) {
      for (let i = 0, l = expansionResults.length; i < l; i++) {
        const expansionResult = expansionResults[i]!;

        if (
          sequentialEqual(expansionResult.literalValues, literalValues) &&
          sequentialEqual(expansionResult.literalPositions, literalPositions)
        ) {
          return {
            strings: expansionResult.expandedStrings,
            values: nonLiteralValues,
          };
        }
      }
    } else {
      expansionResults = [];
      this._expansionResults.set(strings, expansionResults);
    }

    const expandedStrings =
      literalValues.length > 0 ? expandLiterals(strings, values) : strings;

    expansionResults.push({
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
