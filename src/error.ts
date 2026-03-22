import {
  BOUNDARY_TYPE_ERROR,
  type Coroutine,
  type DirectiveType,
  type Part,
  type Scope,
} from './core.js';
import { formatOwnerStack, getOwnerStack } from './debug/coroutine.js';
import { formatPart } from './debug/part.js';
import { formatValue } from './debug/value.js';

export class CoroutineError extends Error {
  constructor(coroutine: Coroutine, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOwnerStack(getOwnerStack(coroutine));
    }
    super(message, options);
  }
}

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

export class AbortError extends CoroutineError {}

export class InterruptError extends CoroutineError {}

export function handleError(error: unknown, scope: Scope): Scope {
  let currentScope = scope;
  let { owner: nextOwner, boundary: nextBoundary } = currentScope;

  const handleError = (error: unknown) => {
    while (true) {
      while (nextBoundary !== null) {
        const boundary = nextBoundary;
        nextBoundary = nextBoundary.next;
        if (boundary.type === BOUNDARY_TYPE_ERROR) {
          const { handler } = boundary;
          handler(error, handleError);
          return;
        }
      }

      if (nextOwner !== null) {
        const { owner, boundary } = nextOwner.scope;
        currentScope = nextOwner.scope;
        nextOwner = owner;
        nextBoundary = boundary;
      } else {
        throw error;
      }
    }
  };

  handleError(error);

  return currentScope;
}
