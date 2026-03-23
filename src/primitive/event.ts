import { sequentialEqual } from '../compare.js';
import {
  type DirectiveContext,
  PART_TYPE_EVENT,
  type Part,
  type Primitive,
} from '../core.js';
import { DirectiveError } from '../error.js';
import { ensurePartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

type EventListenerOrNullish =
  | EventListenerOrEventListenerObject
  | null
  | undefined;

export abstract class EventType {
  static ensureValue(
    value: unknown,
    part: Part,
  ): asserts value is EventListenerOrNullish {
    if (!isEventListnerOrNullish(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'EventType values must be EventListener, EventListenerObject, null or undefined.',
      );
    }
  }

  static resolveBinding(
    value: EventListenerOrNullish,
    part: Part,
    _context: DirectiveContext,
  ): EventBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_EVENT, this, value, part);
    }
    return new EventBinding(value, part);
  }
}

export class EventBinding extends PrimitiveBinding<
  EventListenerOrNullish,
  Part.EventPart
> {
  private _currnetValue: EventListenerOrNullish = null;

  get type(): Primitive<EventListenerOrNullish> {
    return EventType;
  }

  shouldUpdate(value: EventListenerOrNullish): boolean {
    return value !== this._currnetValue;
  }

  override commit(): void {
    const newListener = this._pendingValue;
    const oldListener = this._currnetValue;

    if (
      newListener == null ||
      oldListener == null ||
      !compareEventListenerOptions(newListener, oldListener)
    ) {
      if (oldListener != null) {
        abortEventDelegation(this._part, oldListener, this);
      }
      if (newListener != null) {
        startEventDelegation(this._part, newListener, this);
      }
    }

    this._currnetValue = this._pendingValue;
  }

  override rollback(): void {
    const handler = this._currnetValue;

    if (handler != null) {
      abortEventDelegation(this._part, handler, this);
    }

    this._currnetValue = null;
  }

  handleEvent(event: Event): void {
    if (typeof this._currnetValue === 'function') {
      this._currnetValue(event);
    } else {
      this._currnetValue?.handleEvent(event);
    }
  }
}

function abortEventDelegation(
  part: Part.EventPart,
  listener: NonNullable<EventListenerOrNullish>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  node.removeEventListener(name, delegate, listener as EventListenerOptions);
}

function compareEventListenerOptions(
  newListener: EventListenerOrEventListenerObject,
  oldListener: EventListenerOrEventListenerObject,
): boolean {
  return sequentialEqual(
    getEventListenerOptions(newListener),
    getEventListenerOptions(oldListener),
  );
}

function getEventListenerOptions(
  listener: EventListenerOrEventListenerObject,
): unknown[] {
  const { capture, once, passive, signal } =
    listener as AddEventListenerOptions;
  return [capture, once, passive, signal];
}

function isEventListnerOrNullish(
  value: unknown,
): value is EventListenerOrNullish {
  return (
    value == null ||
    typeof value === 'function' ||
    (typeof value === 'object' &&
      typeof (value as EventListenerObject).handleEvent === 'function')
  );
}

function startEventDelegation(
  part: Part.EventPart,
  listener: NonNullable<EventListenerOrNullish>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  node.addEventListener(name, delegate, listener as EventListenerOptions);
}
