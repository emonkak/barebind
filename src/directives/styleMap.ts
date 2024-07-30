import { shallowEqual } from '../compare.js';
import { ensureDirective, reportPart } from '../error.js';
import {
  type AttributePart,
  type Binding,
  type Directive,
  type Effect,
  type Part,
  PartType,
  type Updater,
  directiveTag,
} from '../types.js';

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTERS_PATTERN = /[A-Z]/g;

export type StyleDeclaration = {
  [P in JSStyleProperties]?: string;
};

type JSStyleProperties =
  | ExtractStringProperties<CSSStyleDeclaration>
  | `--${string}`;

type ExtractStringProperties<T> = {
  [P in keyof T]: P extends string ? (T[P] extends string ? P : never) : never;
}[keyof T];

export function styleMap(styleDeclaration: StyleDeclaration): StyleMap {
  return new StyleMap(styleDeclaration);
}

export class StyleMap implements Directive {
  private readonly _styleDeclaration: StyleDeclaration;

  constructor(styleDeclaration: StyleDeclaration) {
    this._styleDeclaration = styleDeclaration;
  }

  get styleDeclaration(): StyleDeclaration {
    return this._styleDeclaration;
  }

  [directiveTag](part: Part, _updater: Updater<unknown>): StyleMapBinding {
    if (part.type !== PartType.Attribute || part.name !== 'style') {
      throw new Error(
        'StyleMap directive must be used in a "style" attribute, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new StyleMapBinding(this, part);
  }
}

export class StyleMapBinding implements Binding<StyleMap>, Effect {
  private _directive: StyleMap;

  private readonly _part: AttributePart;

  private _memoizedStyleDeclaration: StyleDeclaration = {};

  private _dirty = false;

  constructor(directive: StyleMap, part: AttributePart) {
    this._directive = directive;
    this._part = part;
  }

  get value(): StyleMap {
    return this._directive;
  }

  get part(): AttributePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(updater: Updater<unknown>): void {
    this._requestMutation(updater);
  }

  bind(newValue: StyleMap, updater: Updater<unknown>): void {
    DEBUG: {
      ensureDirective(StyleMap, newValue, this._part);
    }
    const oldValue = this._directive;
    if (!shallowEqual(newValue.styleDeclaration, oldValue.styleDeclaration)) {
      this._directive = newValue;
      this._requestMutation(updater);
    }
  }

  unbind(updater: Updater<unknown>): void {
    const { styleDeclaration } = this._directive;
    if (Object.keys(styleDeclaration).length > 0) {
      this._directive = new StyleMap({});
      this._requestMutation(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;
    const oldStyleDeclaration = this._memoizedStyleDeclaration;
    const newStyleDeclaration = this._directive.styleDeclaration;

    for (const newProperty in newStyleDeclaration) {
      const cssProperty = toCSSProperty(newProperty);
      const cssValue = newStyleDeclaration[newProperty as JSStyleProperties]!;
      style.setProperty(cssProperty, cssValue);
    }

    for (const oldProperty in oldStyleDeclaration) {
      if (!Object.hasOwn(newStyleDeclaration, oldProperty)) {
        const cssProperty = toCSSProperty(oldProperty);
        style.removeProperty(cssProperty);
      }
    }

    this._memoizedStyleDeclaration = newStyleDeclaration;
    this._dirty = false;
  }

  private _requestMutation(updater: Updater<unknown>): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }
}

/**
 * Convert JS style property expressed in lowerCamelCase to CSS style property
 * expressed in kebab-case.
 *
 * @example
 * toCSSProperty('webkitFontSmoothing'); // => '-webkit-font-smoothing'
 * @example
 * toCSSProperty('paddingComponent'); // => 'padding-component'
 * @example
 * // returns the given property as is.
 * toCSSProperty('--my-css-property');
 * toCSSProperty('padding-component');
 */
function toCSSProperty(jsProperty: string): string {
  return jsProperty
    .replace(VENDOR_PREFIX_PATTERN, '-$1')
    .replace(UPPERCASE_LETTERS_PATTERN, (c) => '-' + c.toLowerCase());
}
