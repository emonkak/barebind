import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import type { Part, Updater } from '../types.js';

export class NoValueDirective implements Directive {
  static instance: NoValueDirective = new NoValueDirective();

  private constructor() {
    if (NoValueDirective.instance !== undefined) {
      throw new Error(
        'NoValueDirective constructor cannot be called directly.',
      );
    }
  }

  [directiveTag](part: Part, _updater: Updater): NoValueBinding {
    return new NoValueBinding(part);
  }
}

export class NoValueBinding implements Binding<NoValueDirective> {
  private readonly _part: Part;

  constructor(part: Part) {
    this._part = part;
  }

  get value(): NoValueDirective {
    return NoValueDirective.instance;
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

  connect(_updater: Updater): void {}

  bind(newValue: NoValueDirective, _updater: Updater): void {
    DEBUG: {
      ensureDirective(NoValueDirective, newValue);
    }
  }

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}

export const noValue = NoValueDirective.instance;
