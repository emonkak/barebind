import {
  type AttributePart,
  type Binding,
  type Directive,
  type Effect,
  type Part,
  PartType,
  type UpdateContext,
  type Updater,
  directiveTag,
} from '../baseTypes.js';
import { shallowEqual } from '../compare.js';
import { ensureDirective, reportPart } from '../error.js';

export type StyleDeclaration = {
  [P in JSStyleProperties]?: string;
};

type JSStyleProperties =
  | ExtractStringProperties<CSSStyleDeclaration>
  | `--${string}`;

type ExtractStringProperties<T> = {
  [P in keyof T]: P extends string ? (T[P] extends string ? P : never) : never;
}[keyof T];

const VENDOR_PREFIX_PATTERN = /^(webkit|moz|ms|o)(?=[A-Z])/;
const UPPERCASE_LETTER_PATTERN = /[A-Z]/g;

enum Status {
  Committed,
  Mounting,
  Unmounting,
}

export function styleMap(styles: StyleDeclaration): StyleMap {
  return new StyleMap(styles);
}

export class StyleMap implements Directive {
  private readonly _styles: StyleDeclaration;

  constructor(styles: StyleDeclaration) {
    this._styles = styles;
  }

  get styles(): StyleDeclaration {
    return this._styles;
  }

  [directiveTag](
    part: Part,
    _context: UpdateContext<unknown>,
  ): StyleMapBinding {
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
  private _value: StyleMap;

  private readonly _part: AttributePart;

  private _memoizedStyles: StyleDeclaration = {};

  private _status = Status.Committed;

  constructor(value: StyleMap, part: AttributePart) {
    this._value = value;
    this._part = part;
  }

  get value(): StyleMap {
    return this._value;
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

  connect(context: UpdateContext<unknown>): void {
    this._requestMutation(context.updater, Status.Mounting);
  }

  bind(newValue: StyleMap, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(StyleMap, newValue, this._part);
    }
    if (!shallowEqual(newValue.styles, this._memoizedStyles)) {
      this._requestMutation(context.updater, Status.Mounting);
    }
    this._value = newValue;
  }

  unbind(context: UpdateContext<unknown>): void {
    if (Object.keys(this._memoizedStyles).length > 0) {
      this._requestMutation(context.updater, Status.Unmounting);
    }
  }

  disconnect(): void {}

  commit(): void {
    switch (this._status) {
      case Status.Mounting: {
        const { style } = this._part.node as
          | HTMLElement
          | MathMLElement
          | SVGElement;
        const oldStyles = this._memoizedStyles;
        const newStyles = this._value.styles;

        for (const newProperty in newStyles) {
          const cssProperty = toCSSProperty(newProperty);
          const cssValue = newStyles[newProperty as JSStyleProperties]!;
          style.setProperty(cssProperty, cssValue);
        }

        for (const oldProperty in oldStyles) {
          if (!Object.hasOwn(newStyles, oldProperty)) {
            const cssProperty = toCSSProperty(oldProperty);
            style.removeProperty(cssProperty);
          }
        }

        this._memoizedStyles = newStyles;
        break;
      }
      case Status.Unmounting: {
        const { style } = this._part.node as
          | HTMLElement
          | MathMLElement
          | SVGElement;
        style.cssText = '';
        this._memoizedStyles = {};
      }
    }

    this._status = Status.Committed;
  }

  private _requestMutation(updater: Updater<unknown>, newStatus: Status): void {
    if (this._status === Status.Committed) {
      updater.enqueueMutationEffect(this);
    }
    this._status = newStatus;
  }
}

/**
 * Convert JS style property expressed in lowerCamelCase to CSS style property
 * expressed in kebab-case.
 *
 * @example
 * toCSSProperty('webkitFontSmoothing'); // => '-webkit-font-smoothing'
 * @example
 * toCSSProperty('paddingBlock'); // => 'padding-block'
 * @example
 * // returns the given property as is.
 * toCSSProperty('--my-css-property');
 * toCSSProperty('padding-block');
 */
function toCSSProperty(jsProperty: string): string {
  return jsProperty
    .replace(VENDOR_PREFIX_PATTERN, '-$1')
    .replace(UPPERCASE_LETTER_PATTERN, (c) => '-' + c.toLowerCase());
}
