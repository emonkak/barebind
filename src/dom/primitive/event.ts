import { sequentialEqual } from '../../compare.js';
import type { DirectiveContext, Primitive } from '../../core.js';
import { PrimitiveBinding } from '../../primitive.js';
import { DirectiveError, ensurePartType } from '../error.js';
import { type DOMPart, PART_TYPE_EVENT } from '../part.js';
import type { DOMRenderer } from '../template.js';

type EventListenerOrNullish =
  | (EventListenerOrEventListenerObject & AddEventListenerOptions)
  | null
  | undefined;

export abstract class DOMEvent {
  static ensureValue(
    value: unknown,
    part: DOMPart,
  ): asserts value is EventListenerOrNullish {
    if (!isEventListnerOrNullish(value)) {
      throw new DirectiveError(
        DOMEvent,
        value,
        part,
        'Event values must be EventListener, EventListenerObject, null or undefined.',
      );
    }
  }

  static resolveBinding(
    value: EventListenerOrNullish,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMEventBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_EVENT, DOMEvent, value, part);
    }
    return new DOMEventBinding(value, part);
  }
}

export class DOMEventBinding extends PrimitiveBinding<
  EventListenerOrNullish,
  DOMPart.Event,
  DOMRenderer
> {
  private _currnetValue: EventListenerOrNullish = null;

  get type(): Primitive<EventListenerOrNullish, DOMPart.Event> {
    return DOMEvent;
  }

  shouldUpdate(newListener: EventListenerOrNullish): boolean {
    return newListener !== this._currnetValue;
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
  part: DOMPart.Event,
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
  part: DOMPart.Event,
  listener: NonNullable<EventListenerOrNullish>,
  delegate: EventListenerObject,
): void {
  const { node, name } = part;
  node.addEventListener(name, delegate, listener as EventListenerOptions);
}
