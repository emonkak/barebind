import type { Binding, Layout, Slot, UnwrapBindable } from '../internal.js';

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
