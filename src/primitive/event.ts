import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  EffectContext,
  Primitive,
} from '../directive.js';
import { type EventPart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export type EventListenerValue =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions)
  | null
  | undefined;

export const EventPrimitive = {
  name: 'EventPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is EventListenerValue {
    if (!isEventListenerValue(value)) {
      throw new Error(
        `The value of EventPrimitive must be EventListener, EventListenerObject, null or undefined, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    listener: EventListenerValue,
    part: Part,
    _context: DirectiveContext,
  ): EventBinding {
    if (part.type !== PartType.Event) {
      throw new Error(
        'EventPrimitive must be used in an event part, but it is used here:\n' +
          inspectPart(part, markUsedValue(listener)),
      );
    }
    return new EventBinding(listener, part);
  },
} as const satisfies Primitive<EventListenerValue>;

export class EventBinding extends PrimitiveBinding<
  EventListenerValue,
  EventPart
> {
  private _memoizedValue: EventListenerValue = null;

  get directive(): Primitive<EventListenerValue> {
    return EventPrimitive;
  }

  shouldBind(listener: EventListenerValue): boolean {
    return listener !== this._memoizedValue;
  }

  commit(_context: EffectContext): void {
    const newListener = this._pendingValue;
    const oldListener = this._memoizedValue;

    if (
      typeof oldListener === 'object' ||
      typeof newListener === 'object' ||
      oldListener == null ||
      newListener == null
    ) {
      if (oldListener != null) {
        detachEventListener(this._part, this, oldListener);
      }
      if (newListener != null) {
        attachEventListener(this._part, this, newListener);
      }
    }

    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: EffectContext): void {
    const listener = this._memoizedValue;

    if (listener != null) {
      detachEventListener(this._part, this, listener);
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
  part: EventPart,
  listener: EventListenerObject,
  options: NonNullable<EventListenerValue>,
): void {
  const { node, name } = part;
  if (typeof options === 'function') {
    node.addEventListener(name, listener);
  } else {
    node.addEventListener(name, listener, options);
  }
}

function detachEventListener(
  part: EventPart,
  listener: EventListenerObject,
  options: NonNullable<EventListenerValue>,
): void {
  const { node, name } = part;
  if (typeof options === 'function') {
    node.removeEventListener(name, listener);
  } else {
    node.removeEventListener(name, listener, options);
  }
}

function isEventListenerValue(value: unknown): value is EventListenerValue {
  return (
    value == null ||
    typeof value === 'function' ||
    (typeof value === 'object' &&
      typeof (value as EventListenerObject).handleEvent === 'function')
  );
}
