import { VElement, type VElementType, type VNode } from './vdom.js';

export function jsx<const TProps extends { children?: unknown }>(
  type: VElementType<TProps>,
  props: TProps,
): VElement<TProps> {
  if (Array.isArray(props.children)) {
    return new VElement(type, props, props.children);
  } else {
    return new VElement(type, props, [props.children as VNode]);
  }
}

export const jsxs: typeof jsx = jsx;

declare global {
  namespace JSX {
    type IntrinsicElements = { [K in keyof HTMLElementTagNameMap]: unknown };
  }
}
