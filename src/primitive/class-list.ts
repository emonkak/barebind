import { sequentialEqual, shallowEqual } from '../compare.js';
import type { CommitContext, DirectiveContext, Primitive } from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { AttributePart, Part } from '../part.js';
import { PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type ClassSpecifier = ClassMap | string | null | undefined;

export type ClassMap = { [key: string]: boolean };

export const ClassListPrimitive: Primitive<ClassSpecifier[]> = {
  name: 'ClassListPrimitive',
  ensureValue: (
    value: unknown,
    part: Part,
  ): asserts value is ClassSpecifier[] => {
    if (!(Array.isArray(value) && value.every(isClassSpecifier))) {
      throw new Error(
        `The value of ClassListPrimitive must be array of class specifier, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    specifiers: ClassSpecifier[],
    part: Part,
    _context: DirectiveContext,
  ): ClassListBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':classlist'
    ) {
      throw new Error(
        'ClassListPrimitive must be used in a ":classlist" attribute part, but it is used here:\n' +
          inspectPart(part, markUsedValue(specifiers)),
      );
    }
    return new ClassListBinding(specifiers, part);
  },
};

export class ClassListBinding extends PrimitiveBinding<
  ClassSpecifier[],
  AttributePart
> {
  private _memoizedValue: ClassSpecifier[] = [];

  get type(): Primitive<ClassSpecifier[]> {
    return ClassListPrimitive;
  }

  shouldBind(specifiers: ClassSpecifier[]): boolean {
    return !sequentialEqual(
      specifiers,
      this._memoizedValue,
      areClassSpecifiersEqual,
    );
  }

  commit(_context: CommitContext): void {
    const { classList } = this._part.node;
    const newSpecifiers = this._pendingValue;
    const oldSpecifiers = this._memoizedValue;

    const newTail = newSpecifiers.length - 1;
    const oldTail = oldSpecifiers.length - 1;
    let index = 0;

    for (; index <= newTail && index <= oldTail; index++) {
      const newSpecifier = newSpecifiers[index]!;
      const oldSpecifier = oldSpecifiers[index]!;

      if (typeof newSpecifier === typeof oldSpecifier) {
        updateClasses(classList, newSpecifier, oldSpecifier);
      } else {
        if (oldSpecifier != null) {
          removeClasses(classList, oldSpecifier);
        }

        if (newSpecifier != null) {
          addClasses(classList, newSpecifier);
        }
      }
    }

    for (; index <= oldTail; index++) {
      const specifier = oldSpecifiers[index];
      if (specifier != null) {
        removeClasses(classList, specifier);
      }
    }

    for (; index <= newTail; index++) {
      const specifier = newSpecifiers[index];
      if (specifier != null) {
        addClasses(classList, specifier);
      }
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
    const { classList } = this._part.node;
    const classSpecifiers = this._memoizedValue;

    for (let i = 0, l = classSpecifiers.length; i < l; i++) {
      const classSpecifier = classSpecifiers[i];
      if (classSpecifier != null) {
        removeClasses(classList, classSpecifier);
      }
    }

    this._memoizedValue = [];
  }
}

function addClasses(
  classList: DOMTokenList,
  specifier: NonNullable<ClassSpecifier>,
): void {
  if (typeof specifier === 'string') {
    classList.add(specifier);
  } else {
    for (const key of Object.keys(specifier)) {
      classList.toggle(key, specifier[key]);
    }
  }
}

function areClassSpecifiersEqual(
  x: ClassSpecifier,
  y: ClassSpecifier,
): boolean {
  if (x == null) {
    return y == null;
  }
  if (typeof x === 'string') {
    return x === y;
  }
  if (y == null || typeof y === 'string') {
    return false;
  }
  return shallowEqual(x, y);
}

function isClassSpecifier(value: unknown): value is ClassSpecifier {
  switch (typeof value) {
    case 'string':
    case 'undefined':
    case 'object':
      return true;
    default:
      return false;
  }
}

function removeClasses(
  classList: DOMTokenList,
  specifier: NonNullable<ClassSpecifier>,
): void {
  if (typeof specifier === 'string') {
    classList.remove(specifier);
  } else {
    for (const key of Object.keys(specifier)) {
      if (specifier[key]) {
        classList.remove(key);
      }
    }
  }
}

function updateClasses(
  classList: DOMTokenList,
  newSpecifier: NonNullable<ClassSpecifier>,
  oldSpecifier: NonNullable<ClassSpecifier>,
): void {
  // Precondition: newSpecifier and oldSpecifier are the same type.
  if (typeof newSpecifier === 'string') {
    if (oldSpecifier !== newSpecifier) {
      classList.remove(oldSpecifier as string);
    }
    classList.add(newSpecifier);
  } else {
    for (const key of Object.keys(oldSpecifier as ClassMap)) {
      if (!Object.hasOwn(newSpecifier, key) || !newSpecifier[key]) {
        classList.remove(key);
      }
    }
    for (const key of Object.keys(newSpecifier)) {
      classList.toggle(key, newSpecifier[key]);
    }
  }
}
