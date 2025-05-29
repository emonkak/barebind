import { shallowEqual } from '../compare.js';
import type { DirectiveContext } from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export type StyleValue = {
  [P in StyleProperties]?: string;
} & { [unknownProperty: string]: string };

type StyleProperties = ExtractStringProperties<CSSStyleDeclaration>;

type ExtractStringProperties<T> = {
  [P in keyof T]: T[P] extends string ? P : never;
}[keyof T & string];

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTER_PATTERN = /[A-Z]/g;

export const StylePrimitive: Primitive<StyleValue> = {
  name: 'StylePrimitive',
  ensureValue(value: unknown, part: Part): asserts value is StyleValue {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of StylePrimitive must be Object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: StyleValue,
    part: Part,
    _context: DirectiveContext,
  ): StyleBinding {
    if (part.type !== PartType.Attribute || part.name !== ':style') {
      throw new Error(
        'StylePrimitive must be used in a ":style" attribute part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new StyleBinding(value, part);
  },
};

class StyleBinding extends PrimitiveBinding<StyleValue, AttributePart> {
  private _memoizedValue: StyleValue = {};

  get directive(): Primitive<StyleValue> {
    return StylePrimitive;
  }

  shouldBind(props: StyleValue): boolean {
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
        const cssProperty = toCSSProperty(key);
        style.removeProperty(cssProperty);
      }
    }

    for (const key in newProps) {
      const cssProperty = toCSSProperty(key);
      const cssValue = newProps[cssProperty as StyleProperties]!;
      style.setProperty(cssProperty, cssValue);
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
      const cssProperty = toCSSProperty(key);
      style.removeProperty(cssProperty);
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
