import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type Part,
  type UpdateContext,
  directiveTag,
} from '../baseTypes.js';
import { ensureDirective } from '../debug.js';

export class NoValue implements Directive<NoValue> {
  static readonly instance = new NoValue();

  constructor() {
    if (NoValue.instance !== undefined) {
      throw new Error('NoValue constructor cannot be called directly.');
    }
  }

  [directiveTag](part: Part, _context: DirectiveContext): NoValueBinding {
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

  connect(_context: UpdateContext): void {}

  bind(newValue: NoValue, _context: UpdateContext): void {
    DEBUG: {
      ensureDirective(NoValue, newValue, this._part);
    }
  }

  unbind(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}
}

export const noValue = NoValue.instance;
