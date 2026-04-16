const Primitive = Symbol('Primitive');

export interface Template {
  strings: readonly string[];
  exprs: readonly unknown[];
  mode: TemplateMode;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export namespace Directive {
  export type GenericDirective = PrimitiveDirective | TemplateDirective;

  export interface PrimitiveDirective {
    type: typeof Primitive;
    value: unknown;
  }

  export interface TemplateDirective {
    type: readonly string[];
    value: Template;
  }
}

export class Directive<TType, TValue> {
  type: TType;
  value: TValue;
  key: unknown;

  constructor(type: TType, value: TValue, key?: unknown) {
    this.type = type;
    this.value = value;
    this.key = key;
  }

  withKey(key: unknown): Directive<TType, TValue> {
    return new Directive(this.type, this.value, key);
  }
}

export function wrap(value: unknown): Directive.GenericDirective {
  return value instanceof Directive ? value : new Directive(Primitive, value);
}
