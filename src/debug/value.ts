export const $debug: unique symbol = Symbol('$debug');

const UNQUOTED_PROPERTY_PATTERN = /^[A-Za-z$_][0-9A-Za-z$_]*$/;

export interface Debuggable {
  [$debug](format: (value: unknown) => string): string;
}

export function debugValue(
  value: unknown,
  maxDepth: number = 3,
  seenObjects: object[] = [],
): string {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
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
      if (seenObjects.includes(value)) {
        return '[Circular]';
      }
      seenObjects.push(value);
      try {
        if (isDebuggable(value)) {
          return value[$debug]((v) => debugValue(v, maxDepth, seenObjects));
        }
        switch (value.constructor) {
          case Array:
            if (
              maxDepth < seenObjects.length &&
              (value as unknown[]).length > 0
            ) {
              return '[...]';
            }
            return (
              '[' +
              (value as unknown[])
                .map((v) => debugValue(v, maxDepth, seenObjects))
                .join(', ') +
              ']'
            );
          case Object:
          case null:
          case undefined: {
            if (
              maxDepth < seenObjects.length &&
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
                        debugValue(v, maxDepth, seenObjects),
                    )
                    .join(', ') +
                  ' }'
              : '{}';
          }
          default:
            return value.constructor.name;
        }
      } finally {
        seenObjects.pop();
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
