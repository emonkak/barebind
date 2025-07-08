import type { ElementProps } from './element.js';
import { type VChild, VElement, type VElementType, VFragment } from './vdom.js';

export function jsx<const TProps extends ElementProps & { children?: unknown }>(
  type: VElementType<TProps>,
  props: TProps,
): VElement<TProps> {
  if (typeof type === 'string') {
    const children = Array.isArray(props.children)
      ? props.children
      : [props.children];
    return new VElement(type, props, children);
  } else {
    return new VElement(type, props, []);
  }
}

export const jsxs: typeof jsx = jsx;

export function Fragment(props: { children: VChild[] }): VFragment {
  return new VFragment(props.children);
}

declare global {
  namespace JSX {
    type IntrinsicElements = { [K in keyof HTMLElementTagNameMap]: unknown };
  }
}
