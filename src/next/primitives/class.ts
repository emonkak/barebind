import { PartType } from '../../baseTypes.js';
import { type DirectiveProtocol, resolveBindingTag } from '../coreTypes.js';
import { inspectPart, markUsedValue, nameOf } from '../debug.js';
import type { AttributePart, Part } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export type ClassMap = { [key: string]: boolean };

export type ClassValue = string | ClassMap | (string | ClassMap)[];

export const ClassPrimitive: Primitive<ClassValue> = {
  ensureValue(value: unknown, part: Part): asserts value is ClassValue {
    if (
      !(
        typeof value === 'string' ||
        (typeof value === 'object' && value !== null)
      )
    ) {
      throw new Error(
        `The value of class primitive must be String, Object or Array, but got "${nameOf(value)}".\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  [resolveBindingTag](
    value: ClassValue,
    part: Part,
    _context: DirectiveProtocol,
  ): ClassBinding {
    if (part.type !== PartType.Attribute || part.name !== ':class') {
      throw new Error(
        'ClassMap primitive must be used in a ":class" attribute, but it is used here:\n' +
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
      const childValue = value[i]!;
      if (typeof childValue === 'string') {
        yield [childValue, true];
      } else {
        for (const key in childValue) {
          yield [key, childValue[key]!];
        }
      }
    }
  } else {
    for (const key in value) {
      yield [key, value[key]!];
    }
  }
}
