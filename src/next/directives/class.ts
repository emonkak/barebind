import { shallowEqual } from '../compare.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { DirectiveContext } from '../directive.js';
import { PartType } from '../part.js';
import type { AttributePart, Part } from '../part.js';
import { type Primitive, PrimitiveBinding, noValue } from './primitive.js';

export type ClassMap = { [key: string]: boolean };

export type ClassValue = string | ClassMap | ClassValue[];

export const ClassPrimitive: Primitive<ClassValue> = {
  get name(): string {
    return 'ClassPrimitive';
  },
  ensureValue(value: unknown, part: Part): asserts value is ClassValue {
    if (
      !(
        typeof value === 'string' ||
        (typeof value === 'object' && value !== null)
      )
    ) {
      throw new Error(
        `The value of class primitive must be String, Object or Array, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: ClassValue,
    part: Part,
    _context: DirectiveContext,
  ): ClassBinding {
    if (part.type !== PartType.Attribute || part.name !== ':class') {
      throw new Error(
        'ClassMap primitive must be used in a ":class" attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new ClassBinding(value, part);
  },
};

class ClassBinding extends PrimitiveBinding<ClassValue, AttributePart> {
  get directive(): Primitive<ClassValue> {
    return ClassPrimitive;
  }

  shouldUpdate(newValue: ClassValue, oldValue: ClassValue): boolean {
    switch (typeof newValue) {
      case 'string':
        return typeof oldValue === 'string' && newValue !== oldValue;
      case 'object':
        if (Array.isArray(newValue)) {
          return (
            Array.isArray(oldValue) &&
            (newValue.length !== oldValue.length ||
              newValue.some((value, i) =>
                this.shouldUpdate(value, oldValue[i]!),
              ))
          );
        } else {
          return (
            typeof oldValue === 'object' &&
            !Array.isArray(oldValue) &&
            shallowEqual(newValue, oldValue)
          );
        }
    }
  }

  mount(): void {
    const { classList } = this._part.node;
    if (this._memoizedValue !== noValue) {
      const existingClasses = new Set();
      for (const [className, enabled] of iterateClasses(this._memoizedValue)) {
        classList.toggle(className, enabled);
        existingClasses.add(className);
      }
      for (const [className, enabled] of iterateClasses(this._pendingValue)) {
        if (enabled && !existingClasses.has(className)) {
          classList.remove(className);
        }
      }
    } else {
      for (const [className, enabled] of iterateClasses(this._pendingValue)) {
        classList.toggle(className, enabled);
      }
    }
  }

  unmount(): void {
    const { classList } = this._part.node;
    for (const [className, enabled] of iterateClasses(this._pendingValue)) {
      if (enabled) {
        classList.remove(className);
      }
    }
  }
}

function* iterateClasses(
  value: ClassValue,
): Generator<[className: string, enabled: boolean]> {
  if (typeof value === 'string') {
    yield [value, true];
  } else if (Array.isArray(value)) {
    for (let i = 0, l = value.length; i < l; i++) {
      iterateClasses(value[i]!);
    }
  } else {
    for (const key in value) {
      yield [key, value[key]!];
    }
  }
}
