import {
  type Bindable,
  type Directive,
  type DirectiveElement,
  type RenderContext,
  createDirectiveElement,
} from '../core.js';
import type { AsyncValue } from './async.js';
import { ComponentDirective } from './component.js';

const asyncComponentDirectiveTag = Symbol('AsyncComponent.directive');

export type AsyncComponent<TProps, TResult> = (
  props: TProps,
  context: RenderContext,
) => Promise<Bindable<TResult>>;

export function asyncComponent<TProps, TResult>(
  component: AsyncComponent<TProps, TResult>,
  props: TProps,
): DirectiveElement<TProps> {
  const directive = defineAsyncComponentDirective(component);
  return createDirectiveElement(directive, props);
}

function defineAsyncComponentDirective<TProps, TResult>(
  component: AsyncComponent<TProps, TResult>,
): Directive<TProps> {
  return ((component as any)[asyncComponentDirectiveTag] ??=
    new ComponentDirective(
      (props: TProps, context: RenderContext): AsyncValue<TResult> => ({
        promise: component(props, context),
        options: {},
      }),
    ));
}
