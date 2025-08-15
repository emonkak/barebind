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

type ClassList = readonly ClassAtom[];

interface ClassMap {
  readonly [key: string]: ClassAtom;
}

type ClassAtom = boolean | string | null | undefined;

const CLASS_SEPARATOR_PATTERN = /\s+/;

export const ClassPrimitive: Primitive<ClassSpecifier> = {
  name: 'ClassPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is ClassSpecifier {
    if (!(typeof value === 'object' && value !== null)) {
      throw new Error(
        `The value of ClassPrimitive must be an object, but got ${debugValue(value)}.\n` +
          debugPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    classMap: ClassSpecifier,
    part: Part,
    _context: DirectiveContext,
  ): ClassBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':class'
    ) {
      throw new Error(
        'ClassPrimitive must be used in a ":class" attribute part, but it is used here:\n' +
          debugPart(
            part,
            markUsedValue(new DirectiveSpecifier(this, classMap)),
          ),
      );
    }
    return new ClassBinding(classMap, part);
  },
};

export class ClassBinding extends PrimitiveBinding<
  ClassSpecifier,
  Part.AttributePart
> {
  private _memoizedValue: ClassSpecifier = {};

  get type(): Primitive<ClassSpecifier> {
    return ClassPrimitive;
  }

  shouldBind(classMap: ClassSpecifier): boolean {
    return !shallowEqual(classMap, this._memoizedValue);
  }

  commit(_context: CommitContext): void {
    const { classList } = this._part.node;

    updateClasses(
      classList,
      this._pendingValue as ClassMap,
      this._memoizedValue as ClassMap,
    );

    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
    const { classList } = this._part.node;

    updateClasses(classList, {}, this._memoizedValue as ClassMap);

    this._memoizedValue = {};
  }
}

function toggleClass(
  classList: DOMTokenList,
  key: string,
  value: ClassAtom,
  enabled: boolean,
): void {
  let classInput: string;

  if (typeof value === 'string') {
    classInput = value;
  } else if (value) {
    classInput = key;
  } else {
    return;
  }

  const classNames = classInput.trim().split(CLASS_SEPARATOR_PATTERN);

  for (let i = 0, l = classNames.length; i < l; i++) {
    classList.toggle(classNames[i]!, enabled);
  }
}

function updateClasses(
  classList: DOMTokenList,
  newClasses: ClassMap,
  oldClasses: ClassMap,
): void {
  for (const key of Object.keys(oldClasses)) {
    const value = oldClasses[key];

    if (!Object.hasOwn(newClasses, key)) {
      toggleClass(classList, key, value, false);
    }
  }

  for (const key of Object.keys(newClasses)) {
    const newValue = newClasses[key];
    const oldValue = Object.hasOwn(oldClasses, key)
      ? oldClasses[key]
      : undefined;

    if (newValue !== oldValue) {
      toggleClass(classList, key, oldValue, false);
    }

    toggleClass(classList, key, newValue, true);
  }
}
