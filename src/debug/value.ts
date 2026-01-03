export const $debug: unique symbol = Symbol('$debug');

const UNQUOTED_PROPERTY_PATTERN = /^[A-Za-z$_][0-9A-Za-z$_]*$/;

const MAX_ARRAY_LENGTH = 16;
const MAX_OBJECT_DEPTH = 2;
const MAX_STRING_LENGTH = 128;

export interface Debuggable {
  [$debug](format: (value: unknown) => string): string;
}

export function formatValue(
  value: unknown,
  seenObjects: object[] = [],
): string {
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
      if (seenObjects.includes(value)) {
        return '[Circular]';
      }
      seenObjects.push(value);
      try {
        if (isDebuggable(value)) {
          return value[$debug]((v) => formatValue(v, seenObjects));
        }
        switch (value.constructor) {
          case Array:
            if (
              MAX_OBJECT_DEPTH < seenObjects.length &&
              (value as unknown[]).length > 0
            ) {
              return '[...]';
            }
            return (
              '[' +
              (value as unknown[])
                .map((v) => formatValue(v, seenObjects))
                .slice(0, MAX_ARRAY_LENGTH)
                .join(', ') +
              ((value as unknown[]).length > MAX_ARRAY_LENGTH ? ', ...' : '') +
              ']'
            );
          case Object:
          case null:
          case undefined: {
            if (
              MAX_OBJECT_DEPTH < seenObjects.length &&
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
                        formatValue(v, seenObjects),
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

export function nameOf(value: object): string {
  return typeof value === 'function'
    ? value.name !== ''
      ? value.name
      : value.constructor.name
    : (value.constructor?.name ?? 'Object');
}

function isDebuggable(value: {}): value is Debuggable {
  return $debug in value;
}
