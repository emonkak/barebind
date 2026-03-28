import { Directive } from '../core.js';

export function html(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive.TemplateDirective {
  return new Directive(strings, {
    strings,
    exprs,
    mode: 'html',
  });
}

export function math(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive.TemplateDirective {
  return new Directive(strings, {
    strings,
    exprs,
    mode: 'math',
  });
}

export function svg(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive.TemplateDirective {
  return new Directive(strings, {
    strings,
    exprs,
    mode: 'svg',
  });
}

export function text(
  strings: readonly string[],
  ...exprs: unknown[]
): Directive.TemplateDirective {
  return new Directive(strings, {
    strings,
    exprs,
    mode: 'textarea',
  });
}
