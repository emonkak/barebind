import { shallowEqual } from '../compare.js';
import { ensureDirective, reportPart } from '../error.js';
import {
  type AttributePart,
  type Binding,
  type Directive,
  type Effect,
  type Part,
  PartType,
  type UpdateContext,
  type Updater,
  directiveTag,
} from '../types.js';

export type ClassDeclaration = { [key: string]: boolean };

export function classMap(classDeclaration: ClassDeclaration): ClassMap {
  return new ClassMap(classDeclaration);
}

export class ClassMap implements Directive {
  private readonly _classDeclaration: ClassDeclaration;

  constructor(classDeclaration: ClassDeclaration) {
    this._classDeclaration = classDeclaration;
  }

  get classDeclaration(): ClassDeclaration {
    return this._classDeclaration;
  }

  [directiveTag](
    part: Part,
    _context: UpdateContext<unknown>,
  ): ClassMapBinding {
    if (part.type !== PartType.Attribute || part.name !== 'class') {
      throw new Error(
        'ClassMap directive must be used in a "class" attribute, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new ClassMapBinding(this, part);
  }
}

export class ClassMapBinding implements Effect, Binding<ClassMap> {
  private _value: ClassMap;

  private readonly _part: AttributePart;

  private _dirty = false;

  constructor(value: ClassMap, part: AttributePart) {
    this._value = value;
    this._part = part;
  }

  get value(): ClassMap {
    return this._value;
  }

  get part(): AttributePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext<unknown>): void {
    this._requestMutation(context.updater);
  }

  bind(newValue: ClassMap, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(ClassMap, newValue, this._part);
    }
    const oldValue = this._value;
    if (!shallowEqual(oldValue.classDeclaration, newValue.classDeclaration)) {
      this._value = newValue;
      this.connect(context);
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    const { classDeclaration } = this._value;
    if (Object.keys(classDeclaration).length > 0) {
      this._value = new ClassMap({});
      this._requestMutation(context.updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { classList } = this._part.node;
    const { classDeclaration } = this._value;

    for (const className in classDeclaration) {
      const enabled = classDeclaration[className];
      classList.toggle(className, enabled);
    }

    for (let i = classList.length - 1; i >= 0; i--) {
      const className = classList[i]!;
      if (!Object.hasOwn(classDeclaration, className)) {
        classList.remove(className);
      }
    }

    this._dirty = false;
  }

  private _requestMutation(updater: Updater<unknown>): void {
    if (!this._dirty) {
      this._dirty = true;
      updater.enqueueMutationEffect(this);
    }
  }
}
