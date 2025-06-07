import { shallowEqual } from '../compare.js';
import type { DirectiveContext, Primitive } from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { PartType } from '../part.js';
import type { AttributePart, Part } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type ClassMap = { [key: string]: boolean };

export const ClassMapPrimitive: Primitive<ClassMap> = {
  name: 'ClassMapPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is ClassMap {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of ClassMapPrimitive must be an Object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    classes: ClassMap,
    part: Part,
    _context: DirectiveContext,
  ): ClassMapBinding {
    if (part.type !== PartType.Attribute || part.name !== ':classMap') {
      throw new Error(
        'ClassMapPrimitive must be used in a ":classMap" attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(classes)),
      );
    }
    return new ClassMapBinding(classes, part);
  },
};

class ClassMapBinding extends PrimitiveBinding<ClassMap, AttributePart> {
  private _memoizedValue: ClassMap = {};

  get directive(): Primitive<ClassMap> {
    return ClassMapPrimitive;
  }

  shouldBind(classes: ClassMap): boolean {
    return !shallowEqual(classes, this._memoizedValue);
  }

  commit(): void {
    const newClasses = this._pendingValue;
    const oldClasses = this._memoizedValue;
    const { classList } = this._part.node;

    for (const className in oldClasses) {
      if (oldClasses[className] && !Object.hasOwn(newClasses, className)) {
        classList.remove(className);
      }
    }

    for (const className in newClasses) {
      classList.toggle(className, newClasses[className]);
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    const classes = this._memoizedValue;
    const { classList } = this._part.node;

    for (const className in classes) {
      if (classes[className]) {
        classList.remove(className);
      }
    }

    this._memoizedValue = {};
  }
}
