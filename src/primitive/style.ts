import { shallowEqual } from '../compare.js';
import { formatPart } from '../debug/part.js';
import { formatValue, markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export type StyleProperties = CSSStyleProperties & UnknownStyleProperties;

type CSSStyleProperties = {
  [K in StringKeys<CSSStyleDeclaration>]?: string | null | undefined;
};

interface UnknownStyleProperties {
  [key: string]: string | null | undefined;
}

type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T & string];

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTER_PATTERN = /[A-Z]/g;

export const StylePrimitive: Primitive<StyleProperties> = {
  name: 'StylePrimitive',
  ensureValue(value: unknown, part: Part): asserts value is StyleProperties {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of StylePrimitive must be an object, but got ${formatValue(value)}.\n` +
          formatPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    props: StyleProperties,
    part: Part,
    _context: DirectiveContext,
  ): StyleBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':style'
    ) {
      throw new Error(
        'StylePrimitive must be used in a ":style" attribute part, but it is used here in:\n' +
          formatPart(part, markUsedValue(new DirectiveSpecifier(this, props))),
      );
    }
    return new StyleBinding(props, part);
  },
};

export class StyleBinding extends PrimitiveBinding<
  StyleProperties,
  Part.AttributePart
> {
  private _memoizedValue: StyleProperties = {};

  get type(): Primitive<StyleProperties> {
    return StylePrimitive;
  }

  shouldBind(props: StyleProperties): boolean {
    return !shallowEqual(props, this._memoizedValue);
  }

  commit(): void {
    const newProps = this._pendingValue;
    const oldProps = this._memoizedValue;
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;

    updateStyles(style, newProps, oldProps);

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    const props = this._memoizedValue;
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;

    updateStyles(style, {}, props);

    this._memoizedValue = {};
  }
}

export function updateStyles(
  style: CSSStyleDeclaration,
  newProps: StyleProperties,
  oldProps: StyleProperties,
): void {
  for (const key of Object.keys(oldProps)) {
    if (
      oldProps[key] != null &&
      (!Object.hasOwn(newProps, key) || newProps[key] == null)
    ) {
      const property = toCSSProperty(key);
      style.removeProperty(property);
    }
  }

  for (const key of Object.keys(newProps)) {
    const value = newProps[key];
    if (value != null) {
      const property = toCSSProperty(key);
      style.setProperty(property, value);
    }
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
