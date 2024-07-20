import {
  type AttributePart,
  type Binding,
  type Directive,
  type Effect,
  type Part,
  PartType,
  type Updater,
  directiveTag,
  ensureDirective,
} from '../types.js';
import { shallowEqual } from '../utils.js';

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

  [directiveTag](part: Part, _updater: Updater): ClassMapBinding {
    if (part.type !== PartType.Attribute || part.name !== 'class') {
      throw new Error(
        'ClassMap directive must be used in the "class" attribute.',
      );
    }
    return new ClassMapBinding(this, part);
  }
}

export class ClassMapBinding implements Effect, Binding<ClassMap> {
  private _directive: ClassMap;

  private readonly _part: AttributePart;

  private _dirty = false;

  constructor(directive: ClassMap, part: AttributePart) {
    this._directive = directive;
    this._part = part;
  }

  get value(): ClassMap {
    return this._directive;
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

  connect(updater: Updater): void {
    this._requestMutation(updater);
  }

  bind(newValue: ClassMap, updater: Updater): void {
    DEBUG: {
      ensureDirective(ClassMap, newValue);
    }
    const oldValue = this._directive;
    if (!shallowEqual(oldValue.classDeclaration, newValue.classDeclaration)) {
      this._directive = newValue;
      this.connect(updater);
    }
  }

  unbind(updater: Updater): void {
    const { classDeclaration } = this._directive;
    if (Object.keys(classDeclaration).length > 0) {
      this._directive = new ClassMap({});
      this._requestMutation(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { classList } = this._part.node;
    const { classDeclaration } = this._directive;

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

  private _requestMutation(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }
}
