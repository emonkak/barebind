import { shallowEqual } from '../compare.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  EffectContext,
  Primitive,
} from '../directive.js';
import { type AttributePart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type StyleProps = {
  [P in StyleKeys]?: string | null | undefined;
} & { [unknownProperty: string]: string | null | undefined };

type StyleKeys = StringKeys<CSSStyleDeclaration>;

type StringKeys<T> = {
  [P in keyof T]: T[P] extends string ? P : never;
}[keyof T & string];

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTER_PATTERN = /[A-Z]/g;

export const StylePrimitive = {
  name: 'StylePrimitive',
  ensureValue(value: unknown, part: Part): asserts value is StyleProps {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of StylePrimitive must be object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    props: StyleProps,
    part: Part,
    _context: DirectiveContext,
  ): StyleBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':style'
    ) {
      throw new Error(
        'StylePrimitive must be used in a ":style" attribute part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new StyleBinding(props, part);
  },
} as const satisfies Primitive<StyleProps>;

export class StyleBinding extends PrimitiveBinding<StyleProps, AttributePart> {
  private _memoizedValue: StyleProps = {};

  get directive(): Primitive<StyleProps> {
    return StylePrimitive;
  }

  shouldBind(props: StyleProps): boolean {
    return !shallowEqual(props, this._memoizedValue);
  }

  commit(_context: EffectContext): void {
    const newProps = this._pendingValue;
    const oldProps = this._memoizedValue;
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;

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

    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: EffectContext): void {
    const props = this._memoizedValue;
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;

    for (const key of Object.keys(props)) {
      if (props[key] != null) {
        const property = toCSSProperty(key);
        style.removeProperty(property);
      }
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
