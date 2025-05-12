import type { DirectiveContext } from '../coreTypes.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { type EventPart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding, noValue } from './primitive.js';

export type EventValue = EventListenerOrEventListenerObject | null | undefined;

export const EventPrimitive: Primitive<EventValue> = {
  get name(): string {
    return 'EventPrimitive';
  },
  ensureValue(value: unknown, part: Part): asserts value is EventValue {
    if (
      !(
        value == null ||
        typeof value === 'function' ||
        typeof value === 'object'
      )
    ) {
      throw new Error(
        `The value of class primitive must be EventListener, EventListenerObject, null or undefined, but got "${inspectValue(value)}".\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: EventValue,
    part: Part,
    _context: DirectiveContext,
  ): EventBinding {
    if (part.type !== PartType.Event) {
      throw new Error(
        'Event primitive must be used in an event part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new EventBinding(value, part);
  },
};

export class EventBinding extends PrimitiveBinding<EventValue, EventPart> {
  get directive(): Primitive<EventValue> {
    return EventPrimitive;
  }

  shouldUpdate(newValue: EventValue, oldValue: EventValue): boolean {
    return newValue !== oldValue;
  }

  mount(value: EventValue, part: EventPart): void {
    if (value != null) {
      attachEventListener(part, this, value);
    }
  }

  unmount(value: EventValue, part: EventPart): void {
    if (value != null) {
      detachEventListener(part, this, value);
    }
  }

  update(newValue: EventValue, oldValue: EventValue, part: EventPart): void {
    if (typeof oldValue === 'object' || typeof newValue === 'object') {
      if (oldValue != null) {
        detachEventListener(part, this, oldValue);
      }
      if (newValue != null) {
        attachEventListener(part, this, newValue);
      }
    }
  }

  handleEvent(event: Event): void {
    if (typeof this._memoizedValue === 'function') {
      this._memoizedValue(event);
    } else if (this._memoizedValue !== noValue) {
      this._memoizedValue?.handleEvent(event);
    }
  }
}

function attachEventListener(
  part: EventPart,
  listener: EventListenerObject,
  options: EventListenerOrEventListenerObject,
): void {
  const { node, name } = part;
  if (typeof options === 'function') {
    node.addEventListener(name, listener);
  } else {
    node.addEventListener(name, listener, options as AddEventListenerOptions);
  }
}

function detachEventListener(
  part: EventPart,
  listener: EventListenerObject,
  value: EventListenerOrEventListenerObject,
): void {
  const { node, name } = part;
  if (typeof value === 'function') {
    node.removeEventListener(name, listener);
  } else {
    node.removeEventListener(name, listener, value as AddEventListenerOptions);
  }
}
