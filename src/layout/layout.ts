import { $debug, type Debuggable } from '../debug/value.js';
import {
  $toDirective,
  type Bindable,
  type Directive,
  type DirectiveContext,
  type Layout,
  type Part,
  type UnwrapBindable,
} from '../internal.js';

export class LayoutSpecifier<T>
  implements Bindable<UnwrapBindable<T>>, Debuggable
{
  readonly value: T;

  readonly layout: Layout;

  constructor(value: T, layout: Layout) {
    this.value = value;
    this.layout = layout;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [$debug](format: (value: unknown) => string): string {
    return format(this.value) + ' in ' + this.layout.name;
  }

  [$toDirective](
    part: Part,
    context: DirectiveContext,
  ): Directive<UnwrapBindable<T>> {
    const { value, layout } = this;
    const directive = context.resolveDirective(value, part);
    return { ...directive, layout };
  }
}

export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

export const SlotStatus = {
  Idle: 0,
  Attached: 1,
  Detached: 2,
} as const;
