import {
  type ElementProps,
  VElement,
  type VElementType,
  VFragment,
  type VNode,
  VStaticFragment,
} from './vdom.js';

export const Fragment: unique symbol = Symbol('Fragment');

export function jsx<const TProps extends ElementProps>(
  type: VElementType<TProps> | typeof Fragment,
  props: TProps,
  key?: unknown,
): VElement<TProps> | VFragment {
  return type === Fragment
    ? new VFragment(props.children as VNode[])
    : new VElement(type, props, key);
}

export function jsxs<const TProps extends ElementProps>(
  type: VElementType<TProps> | typeof Fragment,
  props: TProps,
  key?: unknown,
): VElement<TProps> | VStaticFragment {
  return type === Fragment
    ? new VStaticFragment(props.children as VNode[])
    : new VElement(type, props, key, true);
}

export const jsxDEV: typeof jsx = jsx;

export const jsxsDEV: typeof jsxs = jsxs;

declare global {
  namespace JSX {
    type IntrinsicElements = {
      [K in keyof (HTMLElementTagNameMap &
        MathMLElementTagNameMap &
        SVGElementTagNameMap)]: unknown;
    };
  }
}
