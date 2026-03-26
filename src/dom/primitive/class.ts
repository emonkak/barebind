import { shallowEqual } from '../../compare.js';
import type { DirectiveContext, Primitive } from '../../core.js';
import { isObject, PrimitiveBinding } from '../../primitive.js';
import { DirectiveError, ensurePartType } from '../error.js';
import { type DOMPart, PART_TYPE_ATTRIBUTE } from '../part.js';
import type { DOMRenderer } from '../template.js';

export type ClassMap =
  | {
      readonly [index: number]: ClassToken;
    }
  | {
      readonly [key: string]: ClassToken;
    };

export type ClassToken = boolean | string | null | undefined;

const CLASS_SEPARATOR_PATTERN = /\s+/;

export abstract class DOMClass {
  static ensureValue(value: unknown, part: DOMPart): asserts value is ClassMap {
    if (!isObject(value)) {
      throw new DirectiveError(
        DOMClass,
        value,
        part,
        'Class values must be object.',
      );
    }
  }

  static resolveBinding(
    value: ClassMap,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMClassBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_ATTRIBUTE, DOMClass, value, part);
    }
    return new DOMClassBinding(value, part);
  }
}

export class DOMClassBinding extends PrimitiveBinding<
  ClassMap,
  DOMPart.Attribute,
  DOMRenderer
> {
  private _currentValue: ClassMap = {};

  get type(): Primitive<ClassMap, DOMPart.Attribute> {
    return DOMClass;
  }

  shouldUpdate(newTokens: ClassMap): boolean {
    return !shallowEqual(newTokens, this._currentValue);
  }

  override commit(): void {
    const { classList } = this._part.node;
    updateClass(classList, this._pendingValue, this._currentValue);
    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    const { classList } = this.part.node;
    updateClass(classList, {}, this._currentValue);
    this._currentValue = {};
  }
}

function toggleClass(
  classList: DOMTokenList,
  key: string,
  token: ClassToken,
  enabled: boolean,
): void {
  if (typeof token === 'string') {
    token = token.trim();
  } else if (token) {
    token = key.trim();
  } else {
    return;
  }

  if (token !== '') {
    for (const component of token.split(CLASS_SEPARATOR_PATTERN)) {
      classList.toggle(component, enabled);
    }
  }
}

function updateClass(
  classList: DOMTokenList,
  newTokens: Record<string, ClassToken>,
  oldTokens: Record<string, ClassToken>,
): void {
  for (const key of Object.keys(oldTokens)) {
    if (!Object.hasOwn(newTokens, key)) {
      toggleClass(classList, key, oldTokens[key], false);
    }
  }

  for (const key of Object.keys(newTokens)) {
    const newToken = newTokens[key];
    if (Object.hasOwn(oldTokens, key)) {
      const oldToken = oldTokens[key];
      if (newToken !== oldToken) {
        toggleClass(classList, key, oldToken, false);
      }
    }
    toggleClass(classList, key, newToken, true);
  }
}
