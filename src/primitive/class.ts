import { shallowEqual } from '../compare.js';
import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export type ClassSpecifier = ClassList | ClassMap;

type ClassList = readonly ClassValue[];

interface ClassMap {
  readonly [key: string]: ClassValue;
}

type ClassValue = boolean | string | null | undefined;

const CLASS_SEPARATOR_PATTERN = /\s+/;

export const ClassPrimitive: Primitive<ClassSpecifier> = {
  name: 'ClassPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is ClassSpecifier {
    if (!(typeof value === 'object' && value !== null)) {
      throw new DirectiveError(
        ClassPrimitive,
        value,
        part,
        `The value of ClassPrimitive must be an object.`,
      );
    }
  },
  resolveBinding(
    clesses: ClassSpecifier,
    part: Part,
    _context: DirectiveContext,
  ): ClassBinding {
    if (
      part.type !== PartType.Attribute ||
      part.name.toLowerCase() !== ':class'
    ) {
      throw new DirectiveError(
        ClassPrimitive,
        clesses,
        part,
        'ClassPrimitive must be used in a ":class" attribute part.',
      );
    }
    return new ClassBinding(clesses, part);
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

  shouldBind(classes: ClassSpecifier): boolean {
    return !shallowEqual(classes, this._memoizedValue);
  }

  commit(): void {
    const { classList } = this.part.node;

    updateClasses(
      classList,
      this.value as ClassMap,
      this._memoizedValue as ClassMap,
    );

    this._memoizedValue = this.value;
  }

  rollback(): void {
    const { classList } = this.part.node;

    updateClasses(classList, {}, this._memoizedValue as ClassMap);

    this._memoizedValue = {};
  }
}

function toggleClass(
  classList: DOMTokenList,
  key: string,
  value: ClassValue,
  enabled: boolean,
): void {
  let classInput: string;

  if (typeof value === 'string') {
    classInput = value.trim();
  } else if (value) {
    classInput = key.trim();
  } else {
    return;
  }

  if (classInput !== '') {
    const classNames = classInput.split(CLASS_SEPARATOR_PATTERN);

    for (let i = 0, l = classNames.length; i < l; i++) {
      classList.toggle(classNames[i]!, enabled);
    }
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
