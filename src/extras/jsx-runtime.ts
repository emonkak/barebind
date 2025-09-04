import type { StyleProps } from '../primitive/style.js';
import {
  type Ref,
  VElement,
  type VElementType,
  VFragment,
  type VNode,
  VStaticFragment,
} from './vdom.js';

export const Fragment: unique symbol = Symbol('Fragment');

export function jsx<TProps extends {}>(
  type: VElementType<TProps> | typeof Fragment,
  props: TProps & { children?: unknown },
  key?: unknown,
): VElement<TProps> | VFragment {
  return type === Fragment
    ? new VFragment(props.children as VNode[])
    : new VElement(type, props, key);
}

export function jsxs<TProps extends {}>(
  type: VElementType<TProps> | typeof Fragment,
  props: TProps & { children?: unknown },
  key?: unknown,
): VElement<TProps> | VStaticFragment {
  return type === Fragment
    ? new VStaticFragment(props.children as VNode[])
    : new VElement(type, props, key, true);
}

export const jsxDEV: typeof jsx = jsx;

export const jsxsDEV: typeof jsxs = jsxs;

export namespace JSX {
  export type IntrinsicElements = {
    [K in keyof ElementTagNameMap]: ARIAAttributes &
      BuiltInProperties &
      ElementProperties<ElementTagNameMap[K]> &
      UnknownAttributes;
  };

  type ElementTagNameMap = HTMLElementTagNameMap &
    MathMLElementTagNameMap &
    SVGElementTagNameMap;

  type ARIAAttributes = { [K in Hyphenate<keyof ARIAMixin>]?: string };

  interface BuiltInProperties {
    children?: unknown;
    class?: string;
    innerHTML?: string;
    key?: unknown;
    ref?: Ref<Element | null>;
    style?: StyleProps;
    textContent?: string;
  }

  type ElementProperties<T> = {
    [K in Exclude<
      WritableKeys<T>,
      FunctionKeys<T> | ForbiddenElementProperties
    >]?: T[K];
  };

  interface UnknownAttributes {
    [key: string]: unknown;
  }

  type ForbiddenElementProperties =
    | keyof ARIAMixin
    | 'classList'
    | 'innerHTML'
    | 'innerText'
    | 'nodeValue'
    | 'outerHTML'
    | 'outerText'
    | 'scrollLeft'
    | 'scrollTop'
    | 'style'
    | 'textContent';

  type WritableKeys<T> = {
    [K in keyof T]: StrictEqual<
      { -readonly [P in K]-?: T[P] },
      Pick<T, K>
    > extends true
      ? K
      : never;
  }[keyof T];

  type FunctionKeys<T> = {
    [K in keyof T]: T[K] extends Function ? K : never;
  }[keyof T];

  type StrictEqual<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
    T,
  >() => T extends Y ? 1 : 2
    ? true
    : false;

  type Hyphenate<
    TStr extends string,
    TAccumulator extends string = '',
  > = TStr extends `${infer Head}${infer Tail}`
    ? Head extends Uppercase<Head>
      ? TAccumulator extends ''
        ? `${Lowercase<Head>}${Hyphenate<Tail>}`
        : `${TAccumulator}-${Lowercase<Head>}${Hyphenate<Tail>}`
      : Hyphenate<Tail, `${TAccumulator}${Head}`>
    : TAccumulator;
}
