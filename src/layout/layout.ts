import { $debug, type Debuggable } from '../debug/value.js';
import {
  $directive,
  type Bindable,
  type Binding,
  type Directive,
  type Layout,
  type Slot,
  toDirective,
  type UnwrapBindable,
} from '../internal.js';

export const DefaultLayout: Layout = {
  name: 'DefaultLayout',
  compose(): Layout {
    return this;
  },
  placeBinding<T>(
    binding: Binding<UnwrapBindable<T>>,
    defaultLayout: Layout,
  ): Slot<T> {
    return defaultLayout.placeBinding(binding, defaultLayout);
  },
};

export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

export const SlotStatus = {
  Idle: 0,
  Attached: 1,
  Detached: 2,
} as const;

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
    return format(this.source) + ' with ' + this.layout.name;
  }

  [$directive](): Partial<Directive<UnwrapBindable<T>>> {
    const directive = toDirective(this.source);
    const layout =
      directive.layout !== undefined
        ? this.layout.compose(directive.layout)
        : this.layout;
    return {
      ...directive,
      layout,
    };
  }
}
