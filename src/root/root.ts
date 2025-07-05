import type { CommitContext, Effect, Slot } from '../directive.js';

export class MountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(context: CommitContext): void {
    this._container.appendChild(this._slot.part.node);
    this._slot.commit(context);
  }
}

export class UnmountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(context: CommitContext): void {
    this._slot.rollback(context);
    this._container.removeChild(this._slot.part.node);
  }
}
