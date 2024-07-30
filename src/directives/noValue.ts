import { ensureDirective } from '../error.js';
import {
  type Binding,
  type Directive,
  type Part,
  type Updater,
  directiveTag,
} from '../types.js';

export class NoValue implements Directive {
  static readonly instance: NoValue = new NoValue();

  constructor() {
    if (NoValue.instance !== undefined) {
      throw new Error('NoValue constructor cannot be called directly.');
    }
  }

  [directiveTag](part: Part, _updater: Updater<unknown>): NoValueBinding {
    return new NoValueBinding(part);
  }
}

export class NoValueBinding implements Binding<NoValue> {
  private readonly _part: Part;

  constructor(part: Part) {
    this._part = part;
  }

  get value(): NoValue {
    return NoValue.instance;
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

  connect(_updater: Updater<unknown>): void {}

  bind(newValue: NoValue, _updater: Updater<unknown>): void {
    DEBUG: {
      ensureDirective(NoValue, newValue, this._part);
    }
  }

  unbind(_updater: Updater<unknown>): void {}

  disconnect(): void {}
}

export const noValue = NoValue.instance;
