import { Directive } from './core.js';
import { ChildNodeTemplate } from './template/child-node.js';
import { ElementTemplate } from './template/element.js';
import { FragmentTemplate } from './template/fragment.js';

export function Element<TProps, TChildren>(
  name: string,
  props: TProps,
  children: TChildren,
): Directive<readonly [TProps, TChildren]> {
  return new Directive(new ElementTemplate(name), [props, children]);
}

export function Fragment(
  children: readonly unknown[],
): Directive<readonly unknown[]> {
  return new Directive(
    new FragmentTemplate(
      new Array<ChildNodeTemplate<unknown>>(children.length).fill(
        ChildNodeTemplate.Default,
      ),
    ),
    children,
  );
}
