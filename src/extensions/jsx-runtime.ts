import type { DirectiveObject } from '../directive.js';
import {
  createFragment,
  type VChild,
  VElement,
  type VElementType,
  type VProps,
} from './vdom.js';

export function jsx<const TProps extends VProps & { children?: unknown }>(
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

export function Fragment(props: {
  children: VChild[];
}): DirectiveObject<VChild[]> {
  return createFragment(props.children);
}

declare global {
  namespace JSX {
    type IntrinsicElements = { [K in keyof HTMLElementTagNameMap]: unknown };
  }
}
