import { shallowEqual } from '../compare.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { DirectiveContext, Primitive } from '../directive.js';
import type { AttributePart, Part } from '../part.js';
import { PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type ClassMap = { [key: string]: boolean };

export const ClassMapPrimitive = {
  name: 'ClassMapPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is ClassMap {
    if (!isClassMap(value)) {
      throw new Error(
        `The value of ClassMapPrimitive must be object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    classes: ClassMap,
    part: Part,
    _context: DirectiveContext,
  ): ClassMapBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':classmap'
    ) {
      throw new Error(
        'ClassMapPrimitive must be used in a ":classmap" attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(classes)),
      );
    }
    return new ClassMapBinding(classes, part);
  },
} as const satisfies Primitive<ClassMap>;

export class ClassMapBinding extends PrimitiveBinding<ClassMap, AttributePart> {
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

function isClassMap(value: unknown): value is ClassMap {
  return typeof value === 'object' && value !== null;
}
