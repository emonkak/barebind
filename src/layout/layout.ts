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
  readonly layout: Layout;

  readonly value: T;

  constructor(layout: Layout, value: T) {
    this.layout = layout;
    this.value = value;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [$debug](format: (value: unknown) => string): string {
    return this.layout.displayName + '(' + format(this.value) + ')';
  }

  [$toDirective](
    part: Part,
    context: DirectiveContext,
  ): Directive<UnwrapBindable<T>> {
    const { layout, value } = this;
    const directive = context.resolveDirective(value, part);
    return { ...directive, layout };
  }
}
