import { shallowEqual } from '../../compare.js';
import type { DirectiveContext, Primitive } from '../../core.js';
import { isObject, PrimitiveBinding } from '../../primitive.js';
import { DirectiveError, ensurePartType } from '../error.js';
import { type DOMPart, PART_TYPE_ATTRIBUTE } from '../part.js';
import type { DOMRenderer } from '../template.js';

export interface StyleMap extends CSSStyleProperties {
  [unknownProperty: string]: StylePropertyValue;
}

type CSSStyleProperties = {
  [K in ExtractStringKeys<CSSStyleDeclaration>]?: StylePropertyValue;
};

type ExtractStringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T & string];

type StylePropertyValue = string | null | undefined;

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTER_PATTERN = /[A-Z]/g;

export abstract class DOMStyle {
  static ensureValue(value: unknown, part: DOMPart): asserts value is StyleMap {
    if (!isObject(value)) {
      throw new DirectiveError(
        DOMStyle,
        value,
        part,
        'Style values must be object.',
      );
    }
  }

  static resolveBinding(
    styleProps: StyleMap,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMStyleBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_ATTRIBUTE, DOMStyle, styleProps, part);
    }
    return new DOMStyleBinding(styleProps, part);
  }
}

export class DOMStyleBinding extends PrimitiveBinding<
  StyleMap,
  DOMPart.Attribute,
  DOMRenderer
> {
  private _currentValue: StyleMap = {};

  get type(): Primitive<StyleMap, DOMPart.Attribute> {
    return DOMStyle;
  }

  shouldUpdate(newProps: StyleMap): boolean {
    return !shallowEqual(newProps, this._currentValue);
  }

  override commit(): void {
    const declaration = (this._part.node as HTMLElement).style;
    const newProps = this._pendingValue;
    const oldProps = this._currentValue;
    updateStyle(declaration, newProps, oldProps);
    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    const declaration = (this._part.node as HTMLElement).style;
    const props = this._currentValue;
    updateStyle(declaration, {}, props);
    this._currentValue = {};
  }
}

export function updateStyle(
  declaration: CSSStyleDeclaration,
  newProps: StyleMap,
  oldProps: StyleMap,
): void {
  for (const key of Object.keys(oldProps)) {
    if (
      oldProps[key] != null &&
      (!Object.hasOwn(newProps, key) || newProps[key] == null)
    ) {
      const name = toCSSPropertyName(key);
      declaration.removeProperty(name);
    }
  }

  for (const key of Object.keys(newProps)) {
    const value = newProps[key];
    if (value != null) {
      const name = toCSSPropertyName(key);
      declaration.setProperty(name, value);
    }
  }
}

/**
 * Convert style property names expressed in lowerCamelCase to CSS style
 * propertes in kebab-case.
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
function toCSSPropertyName(key: string): string {
  return key
    .replace(VENDOR_PREFIX_PATTERN, '-$1')
    .replace(UPPERCASE_LETTER_PATTERN, (c) => '-' + c.toLowerCase());
}
