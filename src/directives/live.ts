import {
  type Binding,
  CommitStatus,
  type Directive,
  type DirectiveContext,
  type Effect,
  type Part,
  PartType,
  type PropertyPart,
  type UpdateContext,
  directiveTag,
  nameOf,
} from '../baseTypes.js';
import { ensureDirective, reportPart } from '../error.js';

export function live<T>(value: T): Live<T> {
  return new Live(value);
}

export class Live<T> implements Directive<Live<T>> {
  private readonly _value: T;

  constructor(value: T) {
    this._value = value;
  }

  get value(): T {
    return this._value;
  }

  [directiveTag](part: Part, context: DirectiveContext): LiveBinding<T> {
    if (part.type !== PartType.Property) {
      throw new Error(
        'Live directive must be used in an arbitrary property, but it is used here in ' +
          nameOf(context.block?.binding.value ?? 'ROOT') +
          ':\n' +
          reportPart(part, this),
      );
    }
    return new LiveBinding(this, part);
  }
}

export class LiveBinding<T> implements Effect, Binding<Live<T>> {
  private _value: Live<T>;

  private readonly _part: PropertyPart;

  private _status = CommitStatus.Committed;

  constructor(value: Live<T>, part: PropertyPart) {
    this._value = value;
    this._part = part;
  }

  get value(): Live<T> {
    return this._value;
  }

  get part(): PropertyPart {
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

  bind(newValue: Live<T>, context: UpdateContext): void {
    DEBUG: {
      ensureDirective(Live, newValue, this._part);
    }
    const { node, name } = this._part;
    if (newValue.value !== (node as any)[name]) {
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;
    } else {
      this._status = CommitStatus.Committed;
    }
    this._value = newValue;
  }

  unbind(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  disconnect(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        const { node, name } = this._part;
        (node as any)[name] = this._value.value;
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
