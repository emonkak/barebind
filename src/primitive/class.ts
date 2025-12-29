import { shallowEqual } from '../compare.js';
import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export type ClassSpecifier = ClassArray | ClassObject;

type ClassArray = readonly ClassAtom[];

type ClassObject = {
  readonly [key: string]: ClassAtom;
};

type ClassAtom = boolean | string | null | undefined;

const CLASS_SEPARATOR_PATTERN = /\s+/;

export class ClassPrimitive implements Primitive<ClassSpecifier> {
  static readonly instance: ClassPrimitive = new ClassPrimitive();

  ensureValue(value: unknown, part: Part): asserts value is ClassSpecifier {
    if (!isObject(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'The value of ClassPrimitive must be an object.',
      );
    }
  }

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
        this,
        clesses,
        part,
        'ClassPrimitive must be used in a ":class" attribute part.',
      );
    }
    return new ClassBinding(clesses, part);
  }
}

export class ClassBinding extends PrimitiveBinding<
  ClassSpecifier,
  Part.AttributePart
> {
  private _memoizedValue: ClassSpecifier = {};

  get type(): Primitive<ClassSpecifier> {
    return ClassPrimitive.instance;
  }

  shouldUpdate(classes: ClassSpecifier): boolean {
    return !shallowEqual(classes, this._memoizedValue);
  }

  commit(): void {
    const { classList } = this._part.node;

    updateClasses(
      classList,
      this._value as ClassObject,
      this._memoizedValue as ClassObject,
    );

    this._memoizedValue = this._value;
  }

  rollback(): void {
    const { classList } = this.part.node;

    updateClasses(classList, {}, this._memoizedValue as ClassObject);

    this._memoizedValue = {};
  }
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function toggleClass(
  classList: DOMTokenList,
  key: string,
  value: ClassAtom,
  enabled: boolean,
): void {
  let declaration: string;

  if (typeof value === 'string') {
    declaration = value.trim();
  } else if (value) {
    declaration = key.trim();
  } else {
    return;
  }

  if (declaration !== '') {
    const components = declaration.split(CLASS_SEPARATOR_PATTERN);

    for (let i = 0, l = components.length; i < l; i++) {
      classList.toggle(components[i]!, enabled);
    }
  }
}

function updateClasses(
  classList: DOMTokenList,
  newClasses: ClassObject,
  oldClasses: ClassObject,
): void {
  for (const key of Object.keys(oldClasses)) {
    const value = oldClasses[key];

    if (!Object.hasOwn(newClasses, key)) {
      toggleClass(classList, key, value, false);
    }
  }

  for (const key of Object.keys(newClasses)) {
    const newValue = newClasses[key];

    if (Object.hasOwn(oldClasses, key)) {
      const oldValue = oldClasses[key];
      if (newValue !== oldValue) {
        toggleClass(classList, key, oldValue, false);
      }
    }

    toggleClass(classList, key, newValue, true);
  }
}
