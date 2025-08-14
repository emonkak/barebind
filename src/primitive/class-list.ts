import { shallowEqual } from '../compare.js';
import {
  type CommitContext,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../core.js';
import { debugPart } from '../debug/part.js';
import { debugValue, markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import { PrimitiveBinding } from './primitive.js';

export type ClassSpecifier = ClassList | ClassMap;

type ClassRecord = Record<string, ClassAtom>;

type ClassList = readonly ClassAtom[];

type ClassMap = {
  readonly [key: string]: boolean;
};

type ClassAtom = ClassMap | boolean | string | null | undefined;

export const ClassListPrimitive: Primitive<ClassSpecifier> = {
  name: 'ClassListPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is ClassSpecifier {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of ClassListPrimitive must be an array or object, but got ${debugValue(value)}.\n` +
          debugPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    classSpecifier: ClassSpecifier,
    part: Part,
    _context: DirectiveContext,
  ): ClassListBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':classlist'
    ) {
      throw new Error(
        'ClassListPrimitive must be used in a ":classlist" attribute part, but it is used here:\n' +
          debugPart(
            part,
            markUsedValue(new DirectiveSpecifier(this, classSpecifier)),
          ),
      );
    }
    return new ClassListBinding(classSpecifier, part);
  },
};

export class ClassListBinding extends PrimitiveBinding<
  ClassSpecifier,
  Part.AttributePart
> {
  private _memoizedValue: ClassSpecifier = {};

  get type(): Primitive<ClassSpecifier> {
    return ClassListPrimitive;
  }

  shouldBind(classSpecifier: ClassSpecifier): boolean {
    return !shallowEqual(
      classSpecifier as ClassRecord,
      this._memoizedValue as ClassRecord,
      areClassAtomsEqual,
    );
  }

  commit(_context: CommitContext): void {
    const { classList } = this._part.node;
    const newClassSpecifier = this._pendingValue as ClassRecord;
    const oldClassSpecifier = this._memoizedValue as ClassRecord;

    for (const key of Object.keys(oldClassSpecifier)) {
      const newClassAtom = Object.hasOwn(newClassSpecifier, key)
        ? newClassSpecifier[key]
        : undefined;
      const oldClassAtom = oldClassSpecifier[key];

      if (newClassAtom == null && oldClassAtom != null) {
        removeClasses(classList, oldClassAtom, key);
      }
    }

    for (const key of Object.keys(newClassSpecifier)) {
      const newClassAtom = newClassSpecifier[key];
      const oldClassAtom = Object.hasOwn(oldClassSpecifier, key)
        ? oldClassSpecifier[key]
        : undefined;

      if (newClassAtom != null) {
        if (typeof newClassAtom === typeof oldClassAtom) {
          if (newClassAtom !== oldClassAtom) {
            toggleClasses(classList, newClassAtom, oldClassAtom!, key);
          }
        } else {
          if (oldClassAtom != null) {
            removeClasses(classList, oldClassAtom, key);
          }
          addClasses(classList, newClassAtom, key);
        }
      }
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
    const { classList } = this._part.node;
    const classSpecifier = this._memoizedValue as ClassRecord;

    for (const key of Object.keys(classSpecifier)) {
      const classAtom = classSpecifier[key];
      if (classAtom != null) {
        removeClasses(classList, classAtom, key);
      }
    }

    this._memoizedValue = {};
  }
}

function addClasses(
  classList: DOMTokenList,
  classAtom: NonNullable<ClassAtom>,
  key: string,
): void {
  if (typeof classAtom === 'string') {
    classList.add(classAtom);
  } else if (typeof classAtom === 'boolean') {
    if (classAtom) {
      classList.add(key);
    }
  } else {
    for (const key of Object.keys(classAtom)) {
      if (classAtom[key]) {
        classList.add(key);
      }
    }
  }
}

function areClassAtomsEqual(x: ClassAtom, y: ClassAtom): boolean {
  if (x == null) {
    return y == null;
  } else if (typeof x === 'string' || typeof x === 'boolean') {
    return x === y;
  } else {
    return typeof y === 'object' && y !== null && shallowEqual(x, y);
  }
}

function removeClasses(
  classList: DOMTokenList,
  classAtom: NonNullable<ClassAtom>,
  key: string,
): void {
  if (typeof classAtom === 'string') {
    classList.remove(classAtom);
  } else if (typeof classAtom === 'boolean') {
    if (classAtom) {
      classList.remove(key);
    }
  } else {
    for (const key of Object.keys(classAtom)) {
      if (classAtom[key]) {
        classList.remove(key);
      }
    }
  }
}

function toggleClasses(
  classList: DOMTokenList,
  newClassAtom: NonNullable<ClassAtom>,
  oldClassAtom: NonNullable<ClassAtom>,
  key: string,
): void {
  // Precondition: newSpecifier and oldSpecifier are the same type.
  if (typeof newClassAtom === 'string') {
    classList.remove(oldClassAtom as string);
    classList.add(newClassAtom);
  } else if (typeof newClassAtom === 'boolean') {
    classList.toggle(key, newClassAtom);
  } else {
    for (const key of Object.keys(oldClassAtom as ClassMap)) {
      if (!Object.hasOwn(newClassAtom, key) || !newClassAtom[key]) {
        classList.remove(key);
      }
    }
    for (const key of Object.keys(newClassAtom)) {
      classList.toggle(key, newClassAtom[key]);
    }
  }
}
