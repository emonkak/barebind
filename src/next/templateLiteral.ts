import { sequentialEqual } from './compare.js';
import { Literal } from './literal.js';

export interface TemplateLiteral<TValues extends readonly any[]> {
  strings: readonly string[];
  values: TValues;
}

export type NonLiteralValues<TValues extends readonly any[]> =
  TValues extends readonly [infer THead, ...infer TTail]
    ? THead extends Literal
      ? NonLiteralValues<TTail>
      : [THead, ...NonLiteralValues<TTail>]
    : [];

interface TemplateInformation {
  strings: readonly string[];
  literalStrings: readonly string[];
  literalPositions: readonly number[];
}

export class TemplateLiteralPreprocessor {
  private readonly _templateInformations: WeakMap<
    TemplateStringsArray,
    TemplateInformation
  > = new WeakMap();

  expandLiterals<TValues extends readonly any[]>(
    strings: TemplateStringsArray,
    values: TValues,
  ): TemplateLiteral<NonLiteralValues<TValues>> {
    const literalStrings: string[] = [];
    const literalPositions: number[] = [];
    const nonLiteralValues: unknown[] = [];

    for (let i = 0, l = values.length; i < l; i++) {
      const value = values[i];
      if (value instanceof Literal) {
        literalStrings.push(value.toString());
        literalPositions.push(i);
      } else {
        nonLiteralValues.push(value);
      }
    }

    const templateInformaion = this._templateInformations.get(strings);

    if (
      templateInformaion !== undefined &&
      sequentialEqual(templateInformaion.literalStrings, literalStrings) &&
      sequentialEqual(templateInformaion.literalPositions, literalPositions)
    ) {
      return {
        strings: templateInformaion.strings,
        values: nonLiteralValues as NonLiteralValues<TValues>,
      };
    }

    const expandedStrings =
      literalStrings.length > 0 ? expandLiterals(strings, values) : strings;

    this._templateInformations.set(strings, {
      strings: expandedStrings,
      literalStrings,
      literalPositions,
    });

    return {
      strings: expandedStrings,
      values: nonLiteralValues as NonLiteralValues<TValues>,
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
