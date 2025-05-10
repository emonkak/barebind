import { shallowEqual } from '../compare.js';
import { type DirectiveContext, resolveBindingTag } from '../coreTypes.js';
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
  ensureValue(value: unknown, part: Part): asserts value is StyleValue {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of style primitive must be Object, but got "${inspectValue(value)}".\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  [resolveBindingTag](
    value: StyleValue,
    part: Part,
    _context: DirectiveContext,
  ): StyleBinding {
    if (part.type !== PartType.Attribute || part.name !== ':style') {
      throw new Error(
        'Style primitive must be used in a ":style" attribute part, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new StyleBinding(value, part);
  },
};

export class StyleBinding extends PrimitiveBinding<StyleValue, AttributePart> {
  get directive(): typeof StylePrimitive {
    return StylePrimitive;
  }

  shouldUpdate(newValue: StyleValue, oldValue: StyleValue): boolean {
    return shallowEqual(newValue, oldValue);
  }

  mount(value: StyleValue, part: AttributePart): void {
    const { style } = part.node as HTMLElement | MathMLElement | SVGElement;
    for (const property in value) {
      const cssProperty = toCSSProperty(property);
      const cssValue = value[property as StyleProperties]!;
      style.setProperty(cssProperty, cssValue);
    }
  }

  unmount(value: StyleValue, part: AttributePart): void {
    const { style } = part.node as HTMLElement | MathMLElement | SVGElement;
    for (const property in value) {
      const cssProperty = toCSSProperty(property);
      style.removeProperty(cssProperty);
    }
  }

  update(
    oldValue: StyleValue,
    newValue: StyleValue,
    part: AttributePart,
  ): void {
    const { style } = part.node as HTMLElement | MathMLElement | SVGElement;

    for (const newProperty in newValue) {
      const cssProperty = toCSSProperty(newProperty);
      const cssValue = newValue[newProperty as StyleProperties]!;
      style.setProperty(cssProperty, cssValue);
    }

    for (const oldProperty in oldValue) {
      if (!Object.hasOwn(newValue, oldProperty)) {
        const cssProperty = toCSSProperty(oldProperty);
        style.removeProperty(cssProperty);
      }
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
function toCSSProperty(jsProperty: string): string {
  return jsProperty
    .replace(VENDOR_PREFIX_PATTERN, '-$1')
    .replace(UPPERCASE_LETTER_PATTERN, (c) => '-' + c.toLowerCase());
}
