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
  static ensureValue(value: unknown, part: Part): asserts value is ClassMap {
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
    part: Part,
    _context: DirectiveContext,
  ): ClassBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_ATTRIBUTE, this, value, part);
    }
    return new ClassBinding(value, part);
  }
}

export class ClassBinding extends PrimitiveBinding<
  ClassMap,
  Part.AttributePart
> {
  private _memoizedValue: ClassMap = {};

  get type(): Primitive<ClassMap> {
    return ClassType;
  }

  shouldUpdate(classes: ClassMap): boolean {
    return !shallowEqual(classes, this._memoizedValue);
  }

  override commit(): void {
    const { classList } = this._part.node;

    updateClasses(classList, this._value, this._memoizedValue);

    this._memoizedValue = this._value;
  }

  override rollback(): void {
    const { classList } = this.part.node;

    updateClasses(classList, {}, this._memoizedValue);

    this._memoizedValue = {};
  }
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
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
