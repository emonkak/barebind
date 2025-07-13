import {
  type ElementProps,
  VElement,
  type VElementType,
  VFragment,
  type VNode,
  VStaticElement,
} from './vdom.js';

export function jsx<const TProps extends ElementProps>(
  type: VElementType<TProps>,
  props: TProps,
  key?: unknown,
): VElement<TProps> {
  return new VElement(type, props, key);
}

export function jsxs<const TProps extends ElementProps>(
  type: VElementType<TProps>,
  props: TProps,
  key?: unknown,
): VElement<TProps> {
  return new VStaticElement(type, props, key);
}

export const jsxDEV: typeof jsx = jsx;

export const jsxsDEV: typeof jsx = jsxs;

export function Fragment(props: { children: VNode[] }): VFragment {
  return new VFragment(props.children);
}

declare global {
  namespace JSX {
    type IntrinsicElements = {
      [K in keyof (HTMLElementTagNameMap &
        MathMLElementTagNameMap &
        SVGElementTagNameMap)]: unknown;
    };
  }
}
