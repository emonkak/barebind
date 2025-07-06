import { sequentialEqual } from '../compare.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type {
  CommitContext,
  DirectiveContext,
  Primitive,
} from '../directive.js';
import type { AttributePart, Part } from '../part.js';
import { PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type ClassName = ClassMap | string | null | undefined;

export type ClassMap = { [key: string]: boolean };

export const ClassListPrimitive: Primitive<ClassName[]> = {
  name: 'ClassListPrimitive',
  ensureValue: (value: unknown, part: Part): asserts value is ClassName[] => {
    if (!(Array.isArray(value) && value.every(isClassName))) {
      throw new Error(
        `The value of ClassListPrimitive must be array of class name, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    classNames: ClassName[],
    part: Part,
    _context: DirectiveContext,
  ): ClassListBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':classlist'
    ) {
      throw new Error(
        'ClassListPrimitive must be used in a ":classlist" attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(classNames)),
      );
    }
    return new ClassListBinding(classNames, part);
  },
};

export class ClassListBinding extends PrimitiveBinding<
  ClassName[],
  AttributePart
> {
  private _memoizedValue: ClassName[] = [];

  get directive(): Primitive<ClassName[]> {
    return ClassListPrimitive;
  }

  shouldBind(classNames: ClassName[]): boolean {
    return !sequentialEqual(classNames, this._memoizedValue);
  }

  commit(_context: CommitContext): void {
    const { classList } = this._part.node;
    const newClassNames = this._pendingValue;
    const oldClassNames = this._memoizedValue;

    const newTail = newClassNames.length - 1;
    const oldTail = oldClassNames.length - 1;
    let index = 0;

    for (; index <= newTail && index <= oldTail; index++) {
      const newClassName = newClassNames[index]!;
      const oldClassName = oldClassNames[index]!;

      if (typeof newClassName === typeof oldClassName) {
        updateClassNames(classList, newClassName, oldClassName);
      } else {
        if (oldClassName != null) {
          removeClassNames(classList, oldClassName);
        }

        if (newClassName != null) {
          addClassNames(classList, newClassName);
        }
      }
    }

    for (; index <= oldTail; index++) {
      const className = oldClassNames[index];
      if (className != null) {
        removeClassNames(classList, className);
      }
    }

    for (; index <= newTail; index++) {
      const className = newClassNames[index];
      if (className != null) {
        addClassNames(classList, className);
      }
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
    const { classList } = this._part.node;
    const classNames = this._memoizedValue;

    for (let i = 0, l = classNames.length; i < l; i++) {
      const className = classNames[i];
      if (className != null) {
        removeClassNames(classList, className);
      }
    }

    this._memoizedValue = [];
  }
}

function isClassName(value: unknown): value is ClassName {
  switch (typeof value) {
    case 'string':
    case 'undefined':
    case 'object':
      return true;
    default:
      return false;
  }
}

function addClassNames(
  classList: DOMTokenList,
  className: NonNullable<ClassName>,
): void {
  if (typeof className === 'string') {
    classList.add(className);
  } else {
    for (const key of Object.keys(className)) {
      classList.toggle(key, className[key]);
    }
  }
}

function removeClassNames(
  classList: DOMTokenList,
  className: NonNullable<ClassName>,
): void {
  if (typeof className === 'string') {
    classList.remove(className);
  } else {
    for (const key of Object.keys(className)) {
      if (className[key]) {
        classList.remove(key);
      }
    }
  }
}

function updateClassNames(
  classList: DOMTokenList,
  newClassName: NonNullable<ClassName>,
  oldClassName: NonNullable<ClassName>,
): void {
  // Precondition: newClassName and oldClassName are the same type.
  if (typeof newClassName === 'string') {
    if (oldClassName !== newClassName) {
      classList.remove(oldClassName as string);
    }
    classList.add(newClassName);
  } else {
    for (const key of Object.keys(oldClassName as ClassMap)) {
      if (!Object.hasOwn(newClassName, key) || !newClassName[key]) {
        classList.remove(key);
      }
    }
    for (const key of Object.keys(newClassName)) {
      classList.toggle(key, newClassName[key]);
    }
  }
}
