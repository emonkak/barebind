import {
  type CommitContext,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../core.js';
import { debugPart } from '../debug/part.js';
import { debugValue, markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import { PrimitiveBinding } from './primitive.js';

export type EventListenerValue =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions)
  | null
  | undefined;

export const EventPrimitive: Primitive<EventListenerValue> = {
  name: 'EventPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is EventListenerValue {
    if (!isEventListenerValue(value)) {
      throw new Error(
        `The value of EventPrimitive must be an EventListener, EventListenerObject, null or undefined, but got ${debugValue(value)}.\n` +
          debugPart(part, markUsedValue(value)),
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
          debugPart(
            part,
            markUsedValue(new DirectiveSpecifier(this, listener)),
          ),
      );
    }
    return new EventBinding(listener, part);
  },
};

export class EventBinding extends PrimitiveBinding<
  EventListenerValue,
  Part.EventPart
> {
  private _memoizedValue: EventListenerValue = null;

  get type(): Primitive<EventListenerValue> {
    return EventPrimitive;
  }

  shouldBind(listener: EventListenerValue): boolean {
    return listener !== this._memoizedValue;
  }

  commit(_context: CommitContext): void {
    const newListener = this._pendingValue;
    const oldListener = this._memoizedValue;

    if (
      typeof newListener === 'object' ||
      typeof oldListener === 'object' ||
      newListener === undefined ||
      oldListener === undefined
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

  rollback(_context: CommitContext): void {
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
  part: Part.EventPart,
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
  part: Part.EventPart,
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
