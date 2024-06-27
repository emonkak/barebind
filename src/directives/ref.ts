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
  type Ref,
  type Updater,
} from '../types.js';

type ElementRef = Ref<Element | null>;

export function ref(ref: ElementRef | null): RefDirective {
  return new RefDirective(ref);
}

export class RefDirective implements Directive {
  private readonly _ref: ElementRef | null;

  constructor(ref: ElementRef | null) {
    this._ref = ref;
  }

  get ref(): ElementRef | null {
    return this._ref;
  }

  [directiveTag](part: Part, _updater: Updater): RefBinding {
    if (part.type !== PartType.Attribute || part.name !== 'ref') {
      throw new Error('RefDirective must be used in "ref" attribute.');
    }
    return new RefBinding(this, part);
  }
}

export class RefBinding implements Binding<RefDirective>, Effect {
  private _pendingDirective: RefDirective;

  private readonly _part: AttributePart;

  private _memoizedRef: ElementRef | null = null;

  private _dirty = false;

  constructor(directive: RefDirective, part: AttributePart) {
    this._pendingDirective = directive;
    this._part = part;
  }

  get value(): RefDirective {
    return this._pendingDirective;
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
    this._requestEffect(updater);
  }

  bind(newValue: RefDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(RefDirective, newValue);
    }
    const oldValue = this._pendingDirective;
    if (oldValue.ref !== newValue.ref) {
      this._pendingDirective = newValue;
      this.connect(updater);
    }
  }

  unbind(updater: Updater): void {
    const { ref } = this._pendingDirective;
    if (ref !== null) {
      this._pendingDirective = new RefDirective(null);
      this._requestEffect(updater);
    }
  }

  disconnect() {}

  commit(): void {
    const oldRef = this._memoizedRef ?? null;
    const newRef = this._pendingDirective.ref;

    if (oldRef !== null) {
      if (typeof oldRef === 'function') {
        oldRef(null);
      } else {
        oldRef.current = null;
      }
    }

    if (newRef !== null) {
      if (typeof newRef === 'function') {
        newRef(this._part.node);
      } else {
        newRef.current = this._part.node;
      }
    }

    this._memoizedRef = this._pendingDirective.ref;
    this._dirty = false;
  }

  private _requestEffect(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueuePassiveEffect(this);
      this._dirty = true;
    }
  }
}
