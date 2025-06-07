import { sequentialEqual } from './compare.js';
import { Literal } from './core.js';

export interface TemplateLiteral {
  strings: readonly string[];
  values: readonly unknown[];
}

interface TemplateDescriptor {
  strings: readonly string[];
  literalValues: readonly string[];
  literalPositions: readonly number[];
}

export class TemplateLiteralPreprocessor {
  private readonly _templateDescriptors: WeakMap<
    TemplateStringsArray,
    TemplateDescriptor
  > = new WeakMap();

  expandLiterals(
    strings: TemplateStringsArray,
    values: readonly unknown[],
  ): TemplateLiteral {
    const literalValues: string[] = [];
    const literalPositions: number[] = [];
    const nonLiteralValues: unknown[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i];
      if (value instanceof Literal) {
        literalValues.push(value.valueOf());
        literalPositions.push(i);
      } else {
        nonLiteralValues.push(value);
      }
    }

    const descriptor = this._templateDescriptors.get(strings);

    if (
      descriptor !== undefined &&
      sequentialEqual(descriptor.literalValues, literalValues) &&
      sequentialEqual(descriptor.literalPositions, literalPositions)
    ) {
      return {
        strings: descriptor.strings,
        values: nonLiteralValues,
      };
    }

    const expandedStrings =
      literalValues.length > 0 ? expandLiterals(strings, values) : strings;

    this._templateDescriptors.set(strings, {
      strings: expandedStrings,
      literalValues,
      literalPositions,
    });

    return {
      strings: expandedStrings,
      values: nonLiteralValues,
    };
  }
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
