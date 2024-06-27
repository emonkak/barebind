import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import {
  type AttributePart,
  type Effect,
  type Part,
  PartType,
  type Updater,
} from '../types.js';
import { shallowEqual } from '../utils.js';

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTERS_PATTERN = /[A-Z]/g;

export type StyleMap = {
  [P in JSStyleProperties]?: string;
};

type JSStyleProperties =
  | ExtractStringProperties<CSSStyleDeclaration>
  | `--${string}`;

type ExtractStringProperties<T> = {
  [P in keyof T]: P extends string ? (T[P] extends string ? P : never) : never;
}[keyof T];

export function styleMap(styleMap: StyleMap): StyleMapDirective {
  return new StyleMapDirective(styleMap);
}

export class StyleMapDirective implements Directive {
  private readonly _styleMap: StyleMap;

  constructor(styleMap: StyleMap) {
    this._styleMap = styleMap;
  }

  get styleMap(): StyleMap {
    return this._styleMap;
  }

  [directiveTag](part: Part, _updater: Updater): StyleMapBinding {
    if (part.type !== PartType.Attribute || part.name !== 'style') {
      throw new Error('StyleDirective must be used in the "style" attribute.');
    }
    return new StyleMapBinding(this, part);
  }
}

export class StyleMapBinding implements Binding<StyleMapDirective>, Effect {
  private _directive: StyleMapDirective;

  private readonly _part: AttributePart;

  private _memoizedStyleMap: StyleMap = {};

  private _dirty = false;

  constructor(directive: StyleMapDirective, part: AttributePart) {
    this._directive = directive;
    this._part = part;
  }

  get value(): StyleMapDirective {
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

  connect(updater: Updater): void {
    this._requestMutation(updater);
  }

  bind(newValue: StyleMapDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(StyleMapDirective, newValue);
    }
    const oldValue = this._directive;
    if (!shallowEqual(newValue.styleMap, oldValue.styleMap)) {
      this._directive = newValue;
      this._requestMutation(updater);
    }
  }

  unbind(updater: Updater): void {
    const { styleMap } = this._directive;
    if (Object.keys(styleMap).length > 0) {
      this._directive = new StyleMapDirective({});
      this._requestMutation(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;
    const oldStyleMap = this._memoizedStyleMap;
    const newStyleMap = this._directive.styleMap;

    for (const newProperty in newStyleMap) {
      const cssProperty = toCSSProperty(newProperty);
      const cssValue = newStyleMap[newProperty as JSStyleProperties]!;
      style.setProperty(cssProperty, cssValue);
    }

    for (const oldProperty in oldStyleMap) {
      if (!Object.hasOwn(newStyleMap, oldProperty)) {
        const cssProperty = toCSSProperty(oldProperty);
        style.removeProperty(cssProperty);
      }
    }

    this._memoizedStyleMap = newStyleMap;
    this._dirty = false;
  }

  private _requestMutation(updater: Updater): void {
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
