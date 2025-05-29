import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { DirectiveContext } from '../directive.js';
import { type EventPart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

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
        `The value of class primitive must be EventListener, EventListenerObject, null or undefined, but got ${inspectValue(value)}.\n` +
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

  shouldMount(newValue: EventValue, oldValue: EventValue): boolean {
    return newValue !== oldValue;
  }

  mount(
    newListener: EventValue,
    oldListener: EventValue | null,
    part: EventPart,
  ): void {
    if (
      typeof oldListener === 'object' ||
      typeof newListener === 'object' ||
      oldListener == null ||
      newListener == null
    ) {
      if (oldListener != null) {
        detachEventListener(part, this, oldListener);
      }
      if (newListener != null) {
        attachEventListener(part, this, newListener);
      }
    }
  }

  unmount(oldValue: EventValue, part: EventPart): void {
    if (oldValue != null) {
      detachEventListener(part, this, oldValue);
    }
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
