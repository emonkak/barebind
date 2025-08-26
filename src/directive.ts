import { $debug, type Debuggable } from './debug/value.js';
import {
  $toDirective,
  type Bindable,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Part,
  type SlotType,
  type UnwrapBindable,
} from './internal.js';

export class DirectiveSpecifier<T>
  implements Bindable<T>, Debuggable, Directive<T>
{
  readonly type: DirectiveType<T>;

  readonly value: T;

  constructor(type: DirectiveType<T>, value: T) {
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

export class SlotSpecifier<T>
  implements Bindable<UnwrapBindable<T>>, Debuggable
{
  readonly type: SlotType;

  readonly value: T;

  constructor(type: SlotType, value: T) {
    this.type = type;
    this.value = value;
  }

  [$debug](format: (value: unknown) => string): string {
    return this.type.name + '(' + format(this.value) + ')';
  }

  [$toDirective](
    part: Part,
    context: DirectiveContext,
  ): Directive<UnwrapBindable<T>> {
    const { value, type: slotType } = this;
    const directive = context.resolveDirective(value, part);
    return { ...directive, slotType };
  }
}
