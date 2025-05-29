import { sequentialEqual } from '../compare.js';
import type { DirectiveContext } from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { PartType } from '../part.js';
import type { AttributePart, Part } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export type ClassListValue = (string | null | undefined)[];

export const ClassListPrimitive: Primitive<ClassListValue> = {
  name: 'ClassListPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is ClassListValue {
    if (!Array.isArray(value)) {
      throw new Error(
        `The value of ClassListPrimitive must be an Array, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: ClassListValue,
    part: Part,
    _context: DirectiveContext,
  ): ClassListBinding {
    if (part.type !== PartType.Attribute || part.name !== ':classList') {
      throw new Error(
        'ClassListPrimitive must be used in a ":classList" attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new ClassListBinding(value, part);
  },
};

class ClassListBinding extends PrimitiveBinding<ClassListValue, AttributePart> {
  private _memoizedValue: ClassListValue = [];

  get directive(): Primitive<ClassListValue> {
    return ClassListPrimitive;
  }

  shouldBind(classes: ClassListValue): boolean {
    return !sequentialEqual(classes, this._memoizedValue);
  }

  commit(): void {
    const newClasses = this._pendingValue;
    const oldClasses = this._memoizedValue;
    const { classList } = this._part.node;

    reconcileList(classList, newClasses, oldClasses);

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    const classes = this._memoizedValue;
    const { classList } = this._part.node;

    reconcileList(classList, [], classes);

    this._memoizedValue = [];
  }
}

function reconcileList(
  classList: DOMTokenList,
  newClasses: ClassListValue,
  oldClasses: ClassListValue,
): void {
  let i = 0;
  const newTail = newClasses.length - 1;
  const oldTail = oldClasses.length - 1;

  while (i <= newTail && i <= oldTail) {
    const newClass = newClasses[i];
    const oldClass = oldClasses[i];
    if (oldClass != null && newClass !== oldClass) {
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
}
