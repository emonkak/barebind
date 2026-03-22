import {
  type DirectiveContext,
  PART_TYPE_EVENT,
  type Part,
  type Primitive,
} from '../core.js';
import { DirectiveError } from '../error.js';
import { ensurePartType } from '../part.js';
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

export abstract class EventType {
  static ensureValue(
    value: unknown,
    part: Part,
  ): asserts value is EventHandler {
    if (!isEventHandler(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'EventType values must be EventListener, EventListenerObject, null or undefined.',
      );
    }
  }

  static resolveBinding(
    value: EventHandler,
    part: Part,
    _context: DirectiveContext,
  ): EventBinding {
    ensurePartType(PART_TYPE_EVENT, this, value, part);
    return new EventBinding(value, part);
  }
}

export class EventBinding extends PrimitiveBinding<
  EventHandler,
  Part.EventPart
> {
  private _memoizedValue: EventHandler = null;

  get type(): Primitive<EventHandler> {
    return EventType;
  }

  shouldUpdate(value: EventHandler): boolean {
    return value !== this._memoizedValue;
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
