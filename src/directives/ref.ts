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
  nameOf,
} from '../baseTypes.js';
import { ensureDirective, reportPart, reportUsedValue } from '../error.js';

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

  [directiveTag](part: Part, context: DirectiveContext): RefBinding {
    if (part.type !== PartType.Attribute || part.name !== 'ref') {
      throw new Error(
        'Ref directive must be used in a "ref" attribute, but it is used here in ' +
          nameOf(context.block?.binding.value ?? 'ROOT') +
          ':\n' +
          reportPart(part, reportUsedValue(this)),
      );
    }
    return new RefBinding(this, part);
  }
}

export class RefBinding implements Binding<Ref>, Effect {
  private _pendingValue: Ref;

  private _memoizedValue: Ref | null = null;

  private readonly _part: AttributePart;

  private _cleanup: Cleanup | void = undefined;

  private _status = CommitStatus.Committed;

  constructor(directive: Ref, part: AttributePart) {
    this._pendingValue = directive;
    this._part = part;
  }

  get value(): Ref {
    return this._pendingValue;
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
    if (
      this._memoizedValue === null ||
      newValue.ref !== this._memoizedValue.ref
    ) {
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;
    } else {
      this._status = CommitStatus.Committed;
    }
    this._pendingValue = newValue;
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedValue !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(context: UpdateContext): void {
    this.unbind(context);
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        const oldRef = this._memoizedValue?.ref ?? null;
        const newRef = this._pendingValue.ref;
        const cleanup = this._cleanup;
        cleanup?.();
        if (oldRef !== null && typeof oldRef === 'object') {
          oldRef.current = null;
        }
        if (typeof newRef === 'object') {
          newRef.current = this._part.node;
          this._cleanup = undefined;
        } else {
          this._cleanup = newRef(this._part.node);
        }
        this._memoizedValue = this._pendingValue;
        break;
      }
      case CommitStatus.Unmounting: {
        const value = this._memoizedValue;
        const cleanup = this._cleanup;
        cleanup?.();
        if (value !== null && typeof value.ref === 'object') {
          value.ref.current = null;
        }
        this._cleanup = undefined;
        this._memoizedValue = null;
        break;
      }
    }
    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}
