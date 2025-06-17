import type { Effect, Slot } from '../directive.js';

export class MountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    this._container.appendChild(this._slot.part.node);
    this._slot.commit();
  }
}

export class UnmountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    this._slot.rollback();
    this._container.removeChild(this._slot.part.node);
  }
}
