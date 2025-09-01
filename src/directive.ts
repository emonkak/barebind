import { formatPart } from './debug/part.js';
import { $debug, type Debuggable, formatValue } from './debug/value.js';
import {
  $toDirective,
  type Bindable,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Part,
  type SlotType,
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

export class DirectiveSpecifier<T>
  implements Bindable<T>, Debuggable, Directive<T>
{
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

  [$toDirective](): Directive<T> {
    return this;
  }
}

export class SlotSpecifier<T>
  implements Bindable<UnwrapBindable<T>>, Debuggable
{
  readonly type: SlotType;

  readonly value: T;

  constructor(type: SlotType, value: T) {
    this.type = type;
    this.value = value;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [$debug](format: (value: unknown) => string): string {
    return this.type.name + '(' + format(this.value) + ')';
  }

  [$toDirective](
    part: Part,
    context: DirectiveContext,
  ): Directive<UnwrapBindable<T>> {
    const { value, type: slotType } = this;
    const directive = context.resolveDirective(value, part);
    return { ...directive, slotType };
  }
}
