import {
  type AttributePart,
  type Binding,
  CommitStatus,
  type Directive,
  type DirectiveContext,
  type Effect,
  type Part,
  PartType,
  type UpdateContext,
  directiveTag,
} from '../baseTypes.js';
import { shallowEqual } from '../compare.js';
import {
  ensureDirective,
  nameOf,
  reportPart,
  reportUsedValue,
} from '../debug.js';

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

export function styleMap(styles: StyleDeclaration): StyleMap {
  return new StyleMap(styles);
}

export class StyleMap implements Directive<StyleMap> {
  private readonly _styles: StyleDeclaration;

  constructor(styles: StyleDeclaration) {
    this._styles = styles;
  }

  get styles(): StyleDeclaration {
    return this._styles;
  }

  [directiveTag](part: Part, context: DirectiveContext): StyleMapBinding {
    if (part.type !== PartType.Attribute || part.name !== 'style') {
      throw new Error(
        'StyleMap directive must be used in a "style" attribute, but it is used here in ' +
          nameOf(context.block?.binding.value ?? 'ROOT') +
          ':\n' +
          reportPart(part, reportUsedValue(this)),
      );
    }
    return new StyleMapBinding(this, part);
  }
}

export class StyleMapBinding implements Binding<StyleMap>, Effect {
  private _pendingValue: StyleMap;

  private _memoizedValue: StyleMap | null = null;

  private readonly _part: AttributePart;

  private _status = CommitStatus.Committed;

  constructor(value: StyleMap, part: AttributePart) {
    this._pendingValue = value;
    this._part = part;
  }

  get value(): StyleMap {
    return this._pendingValue;
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

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(newValue: StyleMap, context: UpdateContext): void {
    DEBUG: {
      ensureDirective(StyleMap, newValue, this._part);
    }
    if (
      this._memoizedValue === null ||
      !shallowEqual(newValue.styles, this._memoizedValue.styles)
    ) {
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;
    } else {
      this._status = CommitStatus.Committed;
    }
    this._pendingValue = newValue;
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedValue !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        const { style } = this._part.node as
          | HTMLElement
          | MathMLElement
          | SVGElement;
        const oldStyles = this._memoizedValue?.styles ?? {};
        const newStyles = this._pendingValue.styles;

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

        this._memoizedValue = this._pendingValue;
        break;
      }
      case CommitStatus.Unmounting: {
        const { style } = this._part.node as
          | HTMLElement
          | MathMLElement
          | SVGElement;
        style.cssText = '';
        this._memoizedValue = null;
      }
    }

    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
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
