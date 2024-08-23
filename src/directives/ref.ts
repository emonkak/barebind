import {
  type AttributePart,
  type Binding,
  type Cleanup,
  CommitStatus,
  type Directive,
  type DirectiveContext,
  type Effect,
  type Part,
  PartType,
  type RefCallback,
  type RefObject,
  type UpdateContext,
  directiveTag,
} from '../baseTypes.js';
import { ensureDirective, reportPart } from '../error.js';

export type ElementRef = RefCallback<Element> | RefObject<Element | null>;

export function ref(ref: ElementRef): Ref {
  return new Ref(ref);
}

export class Ref implements Directive<Ref> {
  private readonly _ref: ElementRef;

  constructor(ref: ElementRef) {
    this._ref = ref;
  }

  get ref(): ElementRef {
    return this._ref;
  }

  [directiveTag](part: Part, _contex: DirectiveContext): RefBinding {
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
  private _value: Ref;

  private readonly _part: AttributePart;

  private _memoizedRef: ElementRef | null = null;

  private _cleanup: Cleanup | void = undefined;

  private _status = CommitStatus.Committed;

  constructor(directive: Ref, part: AttributePart) {
    this._value = directive;
    this._part = part;
  }

  get value(): Ref {
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

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(newValue: Ref, context: UpdateContext): void {
    DEBUG: {
      ensureDirective(Ref, newValue, this._part);
    }
    if (newValue.ref !== this._memoizedRef) {
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;
    }
    this._value = newValue;
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedRef !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    }
  }

  disconnect(_context: UpdateContext): void {
    this._cleanRef();
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        this._invokeRef();
        break;
      }
      case CommitStatus.Unmounting: {
        this._cleanRef();
        break;
      }
    }

    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueLayoutEffect(this);
    }
  }

  private _cleanRef(): Cleanup | void {
    const ref = this._memoizedRef;
    this._cleanup?.();
    if (ref !== null && typeof ref === 'object') {
      ref.current = null;
    }
    this._cleanup = undefined;
    this._memoizedRef = null;
  }

  private _invokeRef(): Cleanup | void {
    const newRef = this._value.ref;
    const oldRef = this._memoizedRef;
    this._cleanup?.();
    if (oldRef !== null && typeof oldRef === 'object') {
      oldRef.current = null;
    }
    if (typeof newRef === 'object') {
      newRef.current = this._part.node;
      this._cleanup = undefined;
    } else {
      this._cleanup = newRef(this._part.node);
    }
    this._memoizedRef = newRef;
  }
}
