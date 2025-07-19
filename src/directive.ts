import {
  $toDirective,
  type Bindable,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Part,
  type SlotType,
} from './core.js';
import { $debug, type Debuggable } from './debug.js';

export class DirectiveSpecifier<T> implements Bindable<T>, Debuggable {
  readonly type: DirectiveType<T>;

  readonly value: T;

  constructor(type: DirectiveType<T>, value: NoInfer<T>) {
    this.type = type;
    this.value = value;
  }

  [$debug](format: (value: unknown) => string): string {
    return this.type.name + '(' + format(this.value) + ')';
  }

  [$toDirective](): Directive<T> {
    return this;
  }
}

export class SlotSpecifier<T> implements Bindable, Debuggable {
  readonly slotType: SlotType;

  readonly value: T;

  constructor(slotType: SlotType, value: T) {
    this.slotType = slotType;
    this.value = value;
  }

  [$debug](format: (value: unknown) => string): string {
    return this.slotType.name + '(' + format(this.value) + ')';
  }

  [$toDirective](part: Part, context: DirectiveContext): Directive<unknown> {
    const { value, slotType } = this;
    const directive = context.resolveDirective(value, part);
    return { ...directive, slotType };
  }
}
