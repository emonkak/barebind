import { formatPart } from './debug/part.js';
import { $debug, type Debuggable, formatValue } from './debug/value.js';
import {
  $directive,
  type Bindable,
  type Directive,
  type DirectiveType,
  type Layout,
  type Part,
  PartType,
  toDirective,
  type UnwrapBindable,
} from './internal.js';

export class DirectiveError<T> extends Error {
  readonly type: DirectiveType<T>;

  readonly value: T;

  readonly part: Part;

  constructor(type: DirectiveType<T>, value: T, part: Part, message: string) {
    DEBUG: {
      const marker = `[[${type.name}(${formatValue(value)}) IS USED IN HERE!]]`;
      message += '\n' + formatPart(part, marker);
    }

    super(message);

    this.type = type;
    this.value = value;
    this.part = part;
  }
}

export class DirectiveSpecifier<T> implements Bindable<T>, Debuggable {
  readonly type: DirectiveType<T>;

  readonly value: T;

  constructor(type: DirectiveType<T>, value: T) {
    this.type = type;
    this.value = value;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [$debug](format: (value: unknown) => string): string {
    return this.type.name + '(' + format(this.value) + ')';
  }

  [$directive](): Partial<Directive<T>> {
    return this;
  }
}

export class LayoutModifier<T>
  implements Bindable<UnwrapBindable<T>>, Debuggable
{
  readonly source: T;

  readonly layout: Layout;

  constructor(source: T, layout: Layout) {
    this.source = source;
    this.layout = layout;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [$debug](format: (value: unknown) => string): string {
    return format(this.source) + ' with ' + this.layout.name;
  }

  [$directive](): Partial<Directive<UnwrapBindable<T>>> {
    const directive = toDirective(this.source);
    const layout =
      directive.layout !== undefined
        ? this.layout.compose(directive.layout)
        : this.layout;
    return {
      ...directive,
      layout,
    };
  }
}

export function ensurePartType<TExpectedPart extends Part>(
  expectedPartType: TExpectedPart['type'],
  type: DirectiveType<unknown>,
  value: unknown,
  part: Part,
): asserts part is TExpectedPart {
  if (part.type !== expectedPartType) {
    throw new DirectiveError(
      type,
      value,
      part,
      `${type.name} must be used in ${Object.keys(PartType)[expectedPartType]}Part.`,
    );
  }
}
