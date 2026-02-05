import { DirectiveSpecifier } from './directive.js';
import { ChildNodeTemplate } from './template/child-node.js';
import { ElementTemplate } from './template/element.js';
import { FragmentTemplate } from './template/fragment.js';

export function Element<TProps, TChildren>(
  name: string,
  props: TProps,
  children: TChildren,
): DirectiveSpecifier<readonly [TProps, TChildren]> {
  return new DirectiveSpecifier(new ElementTemplate(name), [props, children]);
}

export function Fragment(
  children: readonly unknown[],
): DirectiveSpecifier<readonly unknown[]> {
  return new DirectiveSpecifier(
    new FragmentTemplate(
      new Array<ChildNodeTemplate<unknown>>(children.length).fill(
        ChildNodeTemplate.Default,
      ),
    ),
    children,
  );
}
