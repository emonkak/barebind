import { Directive, type Scope, type Slot } from './core.js';
import { isChildScope } from './scope.js';

export const MAX_ARRAY_LENGTH = 16;
export const MAX_OBJECT_DEPTH = 3;
export const MAX_STRING_LENGTH = 128;

const UNQUOTED_PROPERTY_PATTERN = /^[A-Za-z$_][0-9A-Za-z$_]*$/;

export function formatOnwerStack(ownerStack: Slot[]): string {
  const tail = ownerStack.length - 1;
  return ownerStack
    .map((owner, i) => {
      const prefix = i === tail ? '' : '   '.repeat(tail - i - 1) + '`- ';
      const suffix = i === 0 ? ' <- ERROR occurred here!' : '';
      return prefix + nameOf(owner.directive.type) + suffix;
    })
    .reverse()
    .join('\n');
}

export function formatValue(value: unknown, stack: object[] = []): string {
  switch (typeof value) {
    case 'string':
      return value.length <= MAX_STRING_LENGTH
        ? JSON.stringify(value)
        : 'String';
    case 'number':
      return Object.is(value, -0) ? '-0' : value.toString();
    case 'undefined':
      return 'undefined';
    case 'function':
      return value.name !== ''
        ? `Function(${value.name})`
        : value.constructor.name;
    case 'object':
      if (value === null) {
        return 'null';
      }
      if (value instanceof Directive) {
        return `Directive(${formatValue(value.type, stack)}, ${formatValue(value.value, stack)})`;
      }
      if (stack.includes(value)) {
        return '[Circular]';
      }
      stack.push(value);
      try {
        switch (value.constructor) {
          case Array:
            if (
              MAX_OBJECT_DEPTH < stack.length &&
              (value as unknown[]).length > 0
            ) {
              return '[...]';
            }
            return (
              '[' +
              (value as unknown[])
                .map((v) => formatValue(v, stack))
                .slice(0, MAX_ARRAY_LENGTH)
                .join(', ') +
              ((value as unknown[]).length > MAX_ARRAY_LENGTH ? ', ...' : '') +
              ']'
            );
          case Object:
          case null:
          case undefined: {
            if (
              MAX_OBJECT_DEPTH < stack.length &&
              Object.keys(value).length > 0
            ) {
              return '{...}';
            }
            const entries = Object.entries(value);
            return entries.length > 0
              ? '{ ' +
                  entries
                    .map(
                      ([k, v]) =>
                        (UNQUOTED_PROPERTY_PATTERN.test(k)
                          ? k
                          : JSON.stringify(k)) +
                        ': ' +
                        formatValue(v, stack),
                    )
                    .join(', ') +
                  ' }'
              : '{}';
          }
          default:
            return value.constructor.name;
        }
      } finally {
        stack.pop();
      }
    default:
      return value!.toString();
  }
}

export function getOwnerStack(scope: Scope): Slot[] {
  const ownerStack: Slot[] = [];

  while (isChildScope(scope)) {
    ownerStack.push(scope.owner);
    scope = scope.owner.scope;
  }

  return ownerStack;
}

export function nameOf(type: Directive.ElementDirective['type']): string {
  switch (typeof type) {
    case 'function':
      return type.name;
    case 'symbol':
      return type.description!;
    default:
      return 'Template';
  }
}
