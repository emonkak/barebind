import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import {
  type AttributePart,
  type Effect,
  type Part,
  PartType,
  type Updater,
} from '../types.js';
import { shallowEqual } from '../utils.js';

export type ClassMap = { [key: string]: boolean };

export function classMap(classMap: ClassMap): ClassMapDirective {
  return new ClassMapDirective(classMap);
}

export class ClassMapDirective implements Directive {
  private readonly _classMap: ClassMap;

  constructor(classMap: ClassMap) {
    this._classMap = classMap;
  }

  get classMap(): ClassMap {
    return this._classMap;
  }

  [directiveTag](part: Part, _updater: Updater): ClassMapBinding {
    if (part.type !== PartType.Attribute || part.name !== 'class') {
      throw new Error(
        'ClassMapDirective must be used in the "class" attribute.',
      );
    }
    return new ClassMapBinding(this, part);
  }
}

export class ClassMapBinding implements Effect, Binding<ClassMapDirective> {
  private _directive: ClassMapDirective;

  private readonly _part: AttributePart;

  private _dirty = false;

  constructor(directive: ClassMapDirective, part: AttributePart) {
    this._directive = directive;
    this._part = part;
  }

  get value(): ClassMapDirective {
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

  bind(newValue: ClassMapDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(ClassMapDirective, newValue);
    }
    const oldValue = this._directive;
    if (!shallowEqual(oldValue.classMap, newValue.classMap)) {
      this._directive = newValue;
      this.connect(updater);
    }
  }

  unbind(updater: Updater): void {
    const { classMap } = this._directive;
    if (Object.keys(classMap).length > 0) {
      this._directive = new ClassMapDirective({});
      this._requestMutation(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { classList } = this._part.node;
    const { classMap } = this._directive;

    for (const className in classMap) {
      const enabled = classMap[className];
      classList.toggle(className, enabled);
    }

    for (let i = classList.length - 1; i >= 0; i--) {
      const className = classList[i]!;
      if (!Object.hasOwn(classMap, className)) {
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
