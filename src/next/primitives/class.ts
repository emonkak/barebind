import { shallowEqual } from '../compare.js';
import { type DirectiveContext, resolveBindingTag } from '../coreTypes.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { PartType } from '../part.js';
import type { AttributePart, Part } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export type ClassMap = { [key: string]: boolean };

export type ClassValue = string | ClassMap | ClassValue[];

export const ClassPrimitive: Primitive<ClassValue> = {
  ensureValue(value: unknown, part: Part): asserts value is ClassValue {
    if (
      !(
        typeof value === 'string' ||
        (typeof value === 'object' && value !== null)
      )
    ) {
      throw new Error(
        `The value of class primitive must be String, Object or Array, but got "${inspectValue(value)}".\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  [resolveBindingTag](
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

export class ClassBinding extends PrimitiveBinding<ClassValue, AttributePart> {
  get directive(): typeof ClassPrimitive {
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

  mount(value: ClassValue, part: AttributePart): void {
    const { classList } = part.node;
    for (const [className, enabled] of iterateClasses(value)) {
      classList.toggle(className, enabled);
    }
  }

  unmount(value: ClassValue, part: AttributePart): void {
    const { classList } = part.node;
    for (const [className, enabled] of iterateClasses(value)) {
      if (enabled) {
        classList.remove(className);
      }
    }
  }

  update(
    oldValue: ClassValue,
    newValue: ClassValue,
    part: AttributePart,
  ): void {
    const { classList } = part.node;
    const existingClasses = new Set();

    for (const [className, enabled] of iterateClasses(newValue)) {
      classList.toggle(className, enabled);
      existingClasses.add(className);
    }

    for (const [className, enabled] of iterateClasses(oldValue)) {
      if (enabled && !existingClasses.has(className)) {
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
