import {
  type Binding,
  CommitStatus,
  type Directive,
  type DirectiveContext,
  type Part,
  type UpdateContext,
  directiveTag,
  resolveBinding,
} from '../baseTypes.js';
import { ensureDirective } from '../error.js';

export function teleport<T>(value: T, container: Element): Teleport<T> {
  return new Teleport(value, container);
}

export class Teleport<T> implements Directive<Teleport<T>> {
  private readonly _value: T;

  private readonly _container: Element;

  constructor(value: T, container: Element) {
    this._value = value;
    this._container = container;
  }

  get value(): T {
    return this._value;
  }

  get container(): Element {
    return this._container;
  }

  [directiveTag](part: Part, context: DirectiveContext): TeleportBinding<T> {
    return new TeleportBinding(this, part, context);
  }
}

export class TeleportBinding<T> implements Binding<Teleport<T>> {
  private _value: Teleport<T>;

  private readonly _binding: Binding<T>;

  private _memoizedContainer: Element | null = null;

  private _status = CommitStatus.Committed;

  constructor(value: Teleport<T>, part: Part, context: DirectiveContext) {
    this._value = value;
    this._binding = resolveBinding(value.value, part, context);
  }

  get value(): Teleport<T> {
    return this._value;
  }

  get part(): Part {
    return this._binding.part;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  get binding(): Binding<T> {
    return this._binding;
  }

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._binding.connect(context);
    this._status = CommitStatus.Mounting;
  }

  bind(newValue: Teleport<T>, context: UpdateContext): void {
    DEBUG: {
      ensureDirective(Teleport, newValue, this._binding.part);
    }
    if (newValue.container !== this._memoizedContainer) {
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;
    }
    this._binding.bind(newValue.value, context);
    this._value = newValue;
  }

  unbind(context: UpdateContext): void {
    this._binding.unbind(context);
    if (this._memoizedContainer !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(context: UpdateContext): void {
    // The binding must be unbound even when disconnecting.
    this._binding.unbind(context);
    if (this._memoizedContainer !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        const container = this._value.container;
        const { startNode, endNode } = this._binding;
        let currentNode: ChildNode | null = startNode;
        do {
          const nextNode: ChildNode | null = currentNode.nextSibling;
          container.appendChild(currentNode);
          if (currentNode === endNode) {
            break;
          }
          currentNode = nextNode;
        } while (currentNode !== null);
        this._memoizedContainer = container;
        break;
      }
      case CommitStatus.Unmounting: {
        const container = this._memoizedContainer;
        container?.removeChild(this._binding.part.node);
        this._memoizedContainer = null;
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
