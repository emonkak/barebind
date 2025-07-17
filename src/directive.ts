import {
  $toDirective,
  type Bindable,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type SlotType,
} from './core.js';
import { $inspect, type Inspectable } from './debug.js';
import type { Part } from './part.js';

export class DirectiveSpecifier<T> implements Bindable<T>, Inspectable {
  readonly type: DirectiveType<T>;

  readonly value: T;

  constructor(type: DirectiveType<T>, value: NoInfer<T>) {
    this.type = type;
    this.value = value;
  }

  [$toDirective](): Directive<T> {
    return this;
  }

  [$inspect](inspect: (value: unknown) => string): string {
    return this.type.name + '(' + inspect(this.value) + ')';
  }
}

export class SlotSpecifier<T> implements Bindable {
  readonly slotType: SlotType;

  readonly value: T;

  constructor(slotType: SlotType, value: T) {
    this.slotType = slotType;
    this.value = value;
  }

  [$toDirective](part: Part, context: DirectiveContext): Directive<unknown> {
    const { value, slotType } = this;
    const directive = context.resolveDirective(value, part);
    return { ...directive, slotType };
  }

  [$inspect](inspect: (value: unknown) => string): string {
    return this.slotType.name + '(' + inspect(this.value) + ')';
  }
}
