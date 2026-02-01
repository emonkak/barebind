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
  readonly source: T;

  readonly layout: Layout;

  constructor(source: T, layout: Layout) {
    this.source = source;
    this.layout = layout;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [$debug](format: (value: unknown) => string): string {
    return format(this.source) + ' in ' + this.layout.name;
  }

  [$toDirective](
    part: Part,
    context: DirectiveContext,
  ): Directive<UnwrapBindable<T>> {
    const { source, layout } = this;
    const directive = context.resolveDirective(source, part);
    return { ...directive, layout };
  }
}

export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

export const SlotStatus = {
  Idle: 0,
  Attached: 1,
  Detached: 2,
} as const;
