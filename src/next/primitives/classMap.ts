import { shallowEqual } from '../compare.js';
import type { DirectiveContext } from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { PartType } from '../part.js';
import type { AttributePart, Part } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export type ClassMapValue = { [key: string]: boolean };

export const ClassMapPrimitive: Primitive<ClassMapValue> = {
  name: 'ClassMapPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is ClassMapValue {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of ClassMapPrimitive must be an Object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: ClassMapValue,
    part: Part,
    _context: DirectiveContext,
  ): ClassMapBinding {
    if (part.type !== PartType.Attribute || part.name !== ':classMap') {
      throw new Error(
        'ClassMapPrimitive must be used in a ":classMap" attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new ClassMapBinding(value, part);
  },
};

class ClassMapBinding extends PrimitiveBinding<ClassMapValue, AttributePart> {
  private _memoizedValue: ClassMapValue = {};

  get directive(): Primitive<ClassMapValue> {
    return ClassMapPrimitive;
  }

  shouldBind(classes: ClassMapValue): boolean {
    return !shallowEqual(classes, this._memoizedValue);
  }

  commit(): void {
    const newClassMap = this._pendingValue;
    const oldClassMap = this._memoizedValue;
    const { classList } = this._part.node;

    reconcileMap(classList, newClassMap, oldClassMap);

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    const classMap = this._memoizedValue;
    const { classList } = this._part.node;

    reconcileMap(classList, {}, classMap);

    this._memoizedValue = {};
  }
}

function reconcileMap(
  classList: DOMTokenList,
  newClassMap: ClassMapValue,
  oldClassMap: ClassMapValue,
): void {
  for (const className in oldClassMap) {
    if (oldClassMap[className] && !Object.hasOwn(newClassMap, className)) {
      classList.remove(className);
    }
  }

  for (const className in newClassMap) {
    classList.toggle(className, newClassMap[className]);
  }
}
