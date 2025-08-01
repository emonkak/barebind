export const $debug: unique symbol = Symbol('$debug');

const UNQUOTED_PROPERTY_PATTERN = /^[A-Za-z$_][0-9A-Za-z$_]*$/;

export interface Debuggable {
  [$debug](format: (value: unknown) => string): string;
}

export interface DebugValueContext {
  maxDepth: number;
  maxLength: number;
  seenObjects: object[];
}

export function debugValue(
  value: unknown,
  context: DebugValueContext = {
    maxDepth: 2,
    maxLength: 8,
    seenObjects: [],
  },
): string {
  switch (typeof value) {
    case 'string':
      return value.length <= context.maxLength
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
      if (context.seenObjects.includes(value)) {
        return '[Circular]';
      }
      context.seenObjects.push(value);
      try {
        if (isDebuggable(value)) {
          return value[$debug]((v) => debugValue(v, context));
        }
        switch (value.constructor) {
          case Array:
            if (
              context.maxDepth < context.seenObjects.length &&
              (value as unknown[]).length > 0
            ) {
              return '[...]';
            }
            return (
              '[' +
              (value as unknown[])
                .map((v) => debugValue(v, context))
                .join(', ') +
              ']'
            );
          case Object:
          case null:
          case undefined: {
            if (
              context.maxDepth < context.seenObjects.length &&
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
                        debugValue(v, context),
                    )
                    .join(', ') +
                  ' }'
              : '{}';
          }
          default:
            return value.constructor.name;
        }
      } finally {
        context.seenObjects.pop();
      }
    default:
      return value!.toString();
  }
}

export function markUsedValue(value: unknown): string {
  return `[[${debugValue(value)} IS USED IN HERE!]]`;
}

function isDebuggable(value: {}): value is Debuggable {
  return $debug in value;
}
