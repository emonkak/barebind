import { ensureDirective, reportPart } from '../error.js';
import {
  type AttributePart,
  type Binding,
  type Directive,
  type Effect,
  type Part,
  PartType,
  type RefValue,
  type Updater,
  directiveTag,
} from '../types.js';

type ElementRef = RefValue<Element | null>;

export function ref(ref: ElementRef | null): Ref {
  return new Ref(ref);
}

export class Ref implements Directive {
  private readonly _ref: ElementRef | null;

  constructor(ref: ElementRef | null) {
    this._ref = ref;
  }

  get ref(): ElementRef | null {
    return this._ref;
  }

  [directiveTag](part: Part, _updater: Updater): RefBinding {
    if (part.type !== PartType.Attribute || part.name !== 'ref') {
      throw new Error(
        'Ref directive must be used in a "ref" attribute, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new RefBinding(this, part);
  }
}

export class RefBinding implements Binding<Ref>, Effect {
  private _pendingDirective: Ref;

  private readonly _part: AttributePart;

  private _memoizedRef: ElementRef | null = null;

  private _dirty = false;

  constructor(directive: Ref, part: AttributePart) {
    this._pendingDirective = directive;
    this._part = part;
  }

  get value(): Ref {
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

  bind(newValue: Ref, updater: Updater): void {
    DEBUG: {
      ensureDirective(Ref, newValue, this._part);
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
      this._pendingDirective = new Ref(null);
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
      updater.enqueueLayoutEffect(this);
      this._dirty = true;
    }
  }
}
