import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export type EventHandler<T extends Event = Event> =
  | EventHandlerFunction<T>
  | EventHandlerObject<T>
  | null
  | undefined;

type EventHandlerFunction<T extends Event> = (event: T) => void;

interface EventHandlerObject<T extends Event> extends AddEventListenerOptions {
  handleEvent(event: T): void;
}

export const EventPrimitive: Primitive<EventHandler> = {
  displayName: 'EventPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is EventHandler {
    if (!isEventHandler(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'The value of EventPrimitive must be an EventListener, EventListenerObject, null or undefined.',
      );
    }
  },
  resolveBinding(
    handler: EventHandler,
    part: Part,
    _context: DirectiveContext,
  ): EventBinding {
    if (part.type !== PartType.Event) {
      throw new DirectiveError(
        this,
        handler,
        part,
        'EventPrimitive must be used in an event part.',
      );
    }
    return new EventBinding(handler, part);
  },
};

export class EventBinding extends PrimitiveBinding<
  EventHandler,
  Part.EventPart
> {
  private _memoizedValue: EventHandler = null;

  get type(): Primitive<EventHandler> {
    return EventPrimitive;
  }

  shouldUpdate(handler: EventHandler): boolean {
    return handler !== this._memoizedValue;
  }

  override commit(): void {
    const newHandler = this._value;
    const oldHandler = this._memoizedValue;

    if (
      typeof newHandler === 'object' ||
      typeof oldHandler === 'object' ||
      newHandler === undefined ||
      oldHandler === undefined
    ) {
      if (oldHandler != null) {
        detachEventListener(this._part, oldHandler, this);
      }
      if (newHandler != null) {
        attachEventListener(this._part, newHandler, this);
      }
    }

    this._memoizedValue = this._value;
  }

  override rollback(): void {
    const handler = this._memoizedValue;

    if (handler != null) {
      detachEventListener(this._part, handler, this);
    }

    this._memoizedValue = null;
  }

  handleEvent(event: Event): void {
    if (typeof this._memoizedValue === 'function') {
      this._memoizedValue(event);
    } else {
      this._memoizedValue?.handleEvent(event);
    }
  }
}

function attachEventListener(
  part: Part.EventPart,
  handler: NonNullable<EventHandler>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  if (typeof handler === 'function') {
    node.addEventListener(name, delegate);
  } else {
    node.addEventListener(name, delegate, handler);
  }
}

function detachEventListener(
  part: Part.EventPart,
  handler: NonNullable<EventHandler>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  if (typeof handler === 'function') {
    node.removeEventListener(name, delegate);
  } else {
    node.removeEventListener(name, delegate, handler);
  }
}

function isEventHandler(value: unknown): value is EventHandler {
  return (
    value == null ||
    typeof value === 'function' ||
    (typeof value === 'object' &&
      typeof (value as EventListenerObject).handleEvent === 'function')
  );
}
