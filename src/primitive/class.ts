import { shallowEqual } from '../compare.js';
import type { DirectiveContext, Primitive } from '../core.js';
import {
  DOM_PART_TYPE_ATTRIBUTE,
  type DOMPart,
  ensurePartType,
} from '../dom.js';
import { DirectiveError } from '../error.js';
import { isObject, PrimitiveBinding } from './primitive.js';

export type ClassMap =
  | {
      readonly [index: number]: ClassValue;
    }
  | {
      readonly [key: string]: ClassValue;
    };

export type ClassValue = boolean | string | null | undefined;

const CLASS_SEPARATOR_PATTERN = /\s+/;

export abstract class ClassType {
  static ensureValue(value: unknown, part: DOMPart): asserts value is ClassMap {
    if (!isObject(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'ClassType values must be object.',
      );
    }
  }

  static resolveBinding(
    value: ClassMap,
    part: DOMPart,
    _context: DirectiveContext,
  ): ClassBinding {
    DEBUG: {
      ensurePartType(DOM_PART_TYPE_ATTRIBUTE, this, value, part);
    }
    return new ClassBinding(value, part);
  }
}

export class ClassBinding extends PrimitiveBinding<
  ClassMap,
  DOMPart.AttributePart
> {
  private _currentValue: ClassMap = {};

  get type(): Primitive<ClassMap, DOMPart.AttributePart> {
    return ClassType;
  }

  shouldUpdate(classes: ClassMap): boolean {
    return !shallowEqual(classes, this._currentValue);
  }

  override commit(): void {
    const { classList } = this._part.node;
    updateClasses(classList, this._pendingValue, this._currentValue);
    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    const { classList } = this.part.node;
    updateClasses(classList, {}, this._currentValue);
    this._currentValue = {};
  }
}

function toggleClass(
  classList: DOMTokenList,
  key: string,
  value: ClassValue,
  enabled: boolean,
): void {
  let className: string;

  if (typeof value === 'string') {
    className = value.trim();
  } else if (value) {
    className = key.trim();
  } else {
    return;
  }

  if (className !== '') {
    const components = className.split(CLASS_SEPARATOR_PATTERN);

    for (const component of components) {
      classList.toggle(component, enabled);
    }
  }
}

function updateClasses(
  classList: DOMTokenList,
  newClasses: Record<string, ClassValue>,
  oldClasses: Record<string, ClassValue>,
): void {
  for (const key of Object.keys(oldClasses)) {
    const value = oldClasses[key];

    if (!Object.hasOwn(newClasses, key)) {
      toggleClass(classList, key, value, false);
    }
  }

  for (const key of Object.keys(newClasses)) {
    const newValue = newClasses[key];

    if (Object.hasOwn(oldClasses, key)) {
      const oldValue = oldClasses[key];
      if (newValue !== oldValue) {
        toggleClass(classList, key, oldValue, false);
      }
    }

    toggleClass(classList, key, newValue, true);
  }
}
