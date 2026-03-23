import { Directive, Template } from './core.js';
import { ChildNodeTemplate } from './template/child-node.js';
import { ElementTemplate } from './template/element.js';
import { FragmentTemplate } from './template/fragment.js';

export function Element<TProps, TChildren>(
  name: string,
  props: TProps,
  children: TChildren,
): Directive.Element<readonly [TProps, TChildren]> {
  return new Directive(new ElementTemplate(name), [props, children]);
}

export function Fragment(
  children: readonly unknown[],
): Directive.Element<readonly unknown[]> {
  return new Directive(
    new FragmentTemplate(
      new Array<ChildNodeTemplate<unknown>>(children.length).fill(
        ChildNodeTemplate.Default,
      ),
    ),
    children,
  );
}

export function html(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive.Template<readonly unknown[]> {
  return new Directive(Template, { strings, exprs, mode: 'html' });
}

export function math(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive.Template<readonly unknown[]> {
  return new Directive(Template, { strings, exprs, mode: 'math' });
}

export function svg(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive.Template<readonly unknown[]> {
  return new Directive(Template, { strings, exprs, mode: 'svg' });
}

export function text(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive.Template<readonly unknown[]> {
  return new Directive(Template, { strings, exprs, mode: 'textarea' });
}
