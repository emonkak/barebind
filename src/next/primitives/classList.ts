import { sequentialEqual } from '../compare.js';
import type { DirectiveContext, Primitive } from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { PartType } from '../part.js';
import type { AttributePart, Part } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type ClassList = (string | null | undefined)[];

export const ClassListPrimitive: Primitive<ClassList> = {
  name: 'ClassListPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is ClassList {
    if (!Array.isArray(value)) {
      throw new Error(
        `The value of ClassListPrimitive must be an Array, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    classes: ClassList,
    part: Part,
    _context: DirectiveContext,
  ): ClassListBinding {
    if (part.type !== PartType.Attribute || part.name !== ':classList') {
      throw new Error(
        'ClassListPrimitive must be used in a ":classList" attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(classes)),
      );
    }
    return new ClassListBinding(classes, part);
  },
};

class ClassListBinding extends PrimitiveBinding<ClassList, AttributePart> {
  private _memoizedValue: ClassList = [];

  get directive(): Primitive<ClassList> {
    return ClassListPrimitive;
  }

  shouldBind(classes: ClassList): boolean {
    return !sequentialEqual(classes, this._memoizedValue);
  }

  commit(): void {
    const newClasses = this._pendingValue;
    const oldClasses = this._memoizedValue;
    const { classList } = this._part.node;

    const newTail = newClasses.length - 1;
    const oldTail = oldClasses.length - 1;
    let i = 0;

    while (i <= newTail && i <= oldTail) {
      const newClass = newClasses[i];
      const oldClass = oldClasses[i];
      if (oldClass != null && oldClass !== newClass) {
        classList.remove(oldClass);
      }
      if (newClass != null) {
        classList.add(newClass);
      }
      i++;
    }

    while (i <= oldTail) {
      const className = oldClasses[i];
      if (className != null) {
        classList.remove(className);
      }
      i++;
    }

    while (i <= newTail) {
      const className = newClasses[i];
      if (className != null) {
        classList.add(className);
      }
      i++;
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    const classes = this._memoizedValue;
    const { classList } = this._part.node;

    for (let i = 0, l = classes.length; i < l; i++) {
      const className = classes[i];
      if (className != null) {
        classList.remove(className);
      }
    }

    this._memoizedValue = [];
  }
}
