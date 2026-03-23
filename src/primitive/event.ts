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
  private _memoizedValue: EventListenerOrNullish = null;

  get type(): Primitive<EventListenerOrNullish> {
    return EventType;
  }

  shouldUpdate(value: EventListenerOrNullish): boolean {
    return value !== this._memoizedValue;
  }

  override commit(): void {
    const newListener = this._value;
    const oldListener = this._memoizedValue;

    if (
      typeof newListener === 'object' ||
      typeof oldListener === 'object' ||
      newListener === undefined ||
      oldListener === undefined
    ) {
      if (oldListener != null) {
        uninstallEventListener(this._part, oldListener, this);
      }
      if (newListener != null) {
        installEventListener(this._part, newListener, this);
      }
    }

    this._memoizedValue = this._value;
  }

  override rollback(): void {
    const handler = this._memoizedValue;

    if (handler != null) {
      uninstallEventListener(this._part, handler, this);
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

function installEventListener(
  part: Part.EventPart,
  listener: NonNullable<EventListenerOrNullish>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  if (typeof listener === 'function') {
    node.addEventListener(name, delegate);
  } else {
    node.addEventListener(name, delegate, listener as EventListenerOptions);
  }
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

function uninstallEventListener(
  part: Part.EventPart,
  listener: NonNullable<EventListenerOrNullish>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  if (typeof listener === 'function') {
    node.removeEventListener(name, delegate);
  } else {
    node.removeEventListener(name, delegate, listener as EventListenerOptions);
  }
}
