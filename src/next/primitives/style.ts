import { shallowEqual } from '../compare.js';
import type { DirectiveContext, Primitive } from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type StyleProps = {
  [P in StyleKeys]?: string;
} & { [unknownProperty: string]: string };

type StyleKeys = StringKeys<CSSStyleDeclaration>;

type StringKeys<T> = {
  [P in keyof T]: T[P] extends string ? P : never;
}[keyof T & string];

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTER_PATTERN = /[A-Z]/g;

export const StylePrimitive: Primitive<StyleProps> = {
  name: 'StylePrimitive',
  ensureValue(value: unknown, part: Part): asserts value is StyleProps {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of StylePrimitive must be Object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    props: StyleProps,
    part: Part,
    _context: DirectiveContext,
  ): StyleBinding {
    if (part.type !== PartType.Attribute || part.name !== ':style') {
      throw new Error(
        'StylePrimitive must be used in a ":style" attribute part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new StyleBinding(props, part);
  },
};

class StyleBinding extends PrimitiveBinding<StyleProps, AttributePart> {
  private _memoizedValue: StyleProps = {};

  get directive(): Primitive<StyleProps> {
    return StylePrimitive;
  }

  shouldBind(props: StyleProps): boolean {
    return !shallowEqual(props, this._memoizedValue);
  }

  commit(): void {
    const newProps = this._pendingValue;
    const oldProps = this._memoizedValue;
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;

    for (const key in oldProps) {
      if (!Object.hasOwn(newProps, key)) {
        const property = toCSSProperty(key);
        style.removeProperty(property);
      }
    }

    for (const key in newProps) {
      const property = toCSSProperty(key);
      const value = newProps[property as StyleKeys]!;
      style.setProperty(property, value);
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    const props = this._memoizedValue;
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;

    for (const key in props) {
      const property = toCSSProperty(key);
      style.removeProperty(property);
    }

    this._memoizedValue = {};
  }
}

/**
 * Convert the JS style property expressed in lowerCamelCase to CSS style
 * property expressed in kebab-case.
 *
 * @example
 * toCSSProperty('webkitFontSmoothing'); // => '-webkit-font-smoothing'
 * @example
 * toCSSProperty('paddingBlock'); // => 'padding-block'
 * @example
 * // returns the given property as is.
 * toCSSProperty('--my-css-property'); // => '--my-css-property'
 * toCSSProperty('padding-block'); // => 'padding-block'
 */
function toCSSProperty(key: string): string {
  return key
    .replace(VENDOR_PREFIX_PATTERN, '-$1')
    .replace(UPPERCASE_LETTER_PATTERN, (c) => '-' + c.toLowerCase());
}
