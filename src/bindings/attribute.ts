import {
  type AttributePart,
  type Binding,
  CommitStatus,
  type Effect,
  type UpdateContext,
} from '../baseTypes.js';
import { ensureNonDirective } from '../error.js';

export class AttributeBinding<T> implements Binding<T>, Effect {
  private _pendingValue: T;

  private _memoizedValue: T | null = null;

  private readonly _part: AttributePart;

  private _status = CommitStatus.Committed;

  constructor(value: T, part: AttributePart) {
    DEBUG: {
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): T {
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

  bind(newValue: T, context: UpdateContext): void {
    DEBUG: {
      ensureNonDirective(newValue, this._part);
    }
    if (!Object.is(this._memoizedValue, newValue)) {
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;
    }
    this._pendingValue = newValue;
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedValue != null) {
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
      case CommitStatus.Mounting: {
        const { node, name } = this._part;
        const value = this._pendingValue;

        if (typeof value === 'string') {
          node.setAttribute(name, value);
        } else if (typeof value === 'boolean') {
          node.toggleAttribute(name, value);
        } else if (value == null) {
          node.removeAttribute(name);
        } else {
          node.setAttribute(name, value.toString());
        }

        this._memoizedValue = this._pendingValue;
        break;
      }
      case CommitStatus.Unmounting: {
        const { node, name } = this._part;
        node.removeAttribute(name);
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
