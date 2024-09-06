import {
  type Binding,
  CommitStatus,
  type Effect,
  type Part,
  type UpdateContext,
} from '../baseTypes.js';
import { ensureNonDirective } from '../error.js';

export class NodeBinding<T> implements Binding<T>, Effect {
  private _pendingValue: T;

  private _memoizedValue: T | null = null;

  private readonly _part: Part;

  private _status = CommitStatus.Committed;

  constructor(value: T, part: Part) {
    DEBUG: {
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): T {
    return this._pendingValue;
  }

  get part(): Part {
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

  bind(newValue: T, context: UpdateContext): void {
    DEBUG: {
      ensureNonDirective(newValue, this._part);
    }
    if (!Object.is(this._memoizedValue, newValue)) {
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

  disconnect(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting:
        this._part.node.nodeValue =
          typeof this._pendingValue === 'string'
            ? this._pendingValue
            : this._pendingValue?.toString() ?? null;
        this._memoizedValue = this._pendingValue;
        break;

      case CommitStatus.Unmounting:
        this._part.node.nodeValue = null;
        this._memoizedValue = null;
        break;
    }

    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}
