import { shallowEqual } from '../compare.js';
import {
  type DirectiveContext,
  PART_TYPE_ATTRIBUTE,
  type Part,
  type Primitive,
} from '../core.js';
import { DirectiveError } from '../error.js';
import { ensurePartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export interface StyleMap extends CSSStyleProperties {
  [unknownProperty: string]: StyleValue;
}

type CSSStyleProperties = {
  [K in ExtractStringKeys<CSSStyleDeclaration>]?: StyleValue;
};

type ExtractStringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T & string];

type StyleValue = string | null | undefined;

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTER_PATTERN = /[A-Z]/g;

export abstract class StyleType {
  static ensureValue(value: unknown, part: Part): asserts value is StyleMap {
    if (!(typeof value === 'object' && value !== null)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'StyleType values must be object.',
      );
    }
  }

  static resolveBinding(
    value: StyleMap,
    part: Part,
    _context: DirectiveContext,
  ): StyleBinding {
    ensurePartType(PART_TYPE_ATTRIBUTE, this, value, part);
    return new StyleBinding(value, part);
  }
}

export class StyleBinding extends PrimitiveBinding<
  StyleMap,
  Part.AttributePart
> {
  private _memoizedValue: StyleMap = {};

  get type(): Primitive<StyleMap> {
    return StyleType;
  }

  shouldUpdate(value: StyleMap): boolean {
    return !shallowEqual(value, this._memoizedValue);
  }

  override commit(): void {
    const declaration = (this._part.node as HTMLElement).style;
    const newStyles = this._value;
    const oldStyles = this._memoizedValue;
    updateStyles(declaration, newStyles, oldStyles);
    this._memoizedValue = this._value;
  }

  override rollback(): void {
    const declaration = (this._part.node as HTMLElement).style;
    const styles = this._memoizedValue;
    updateStyles(declaration, {}, styles);
    this._memoizedValue = {};
  }
}

export function updateStyles(
  declaration: CSSStyleDeclaration,
  newStyles: StyleMap,
  oldStyles: StyleMap,
): void {
  for (const key of Object.keys(oldStyles)) {
    if (
      oldStyles[key] != null &&
      (!Object.hasOwn(newStyles, key) || newStyles[key] == null)
    ) {
      const property = toCSSProperty(key);
      declaration.removeProperty(property);
    }
  }

  for (const key of Object.keys(newStyles)) {
    const value = newStyles[key];
    if (value != null) {
      const property = toCSSProperty(key);
      declaration.setProperty(property, value);
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
