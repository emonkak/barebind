import {
  type Binding,
  CommitStatus,
  type Effect,
  type EventPart,
  type Part,
  type UpdateContext,
} from '../baseTypes.js';
import { ensureNonDirective, reportPart, reportUsedValue } from '../debug.js';

type Nullable<T> = T | null | undefined;

export class EventBinding
  implements Binding<Nullable<EventListenerOrEventListenerObject>>, Effect
{
  private _pendingValue: Nullable<EventListenerOrEventListenerObject>;

  private _memoizedValue: Nullable<EventListenerOrEventListenerObject>;

  private readonly _part: EventPart;

  private _status = CommitStatus.Committed;

  constructor(value: unknown, part: EventPart) {
    DEBUG: {
      ensureEventListenerOrNull(value, part);
      ensureNonDirective(value, part);
    }
    this._pendingValue = value;
    this._part = part;
  }

  get value(): Nullable<EventListenerOrEventListenerObject> {
    return this._pendingValue;
  }

  get part(): EventPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(
    newValue: Nullable<EventListenerOrEventListenerObject>,
    context: UpdateContext,
  ): void {
    DEBUG: {
      ensureEventListenerOrNull(newValue, this._part);
      ensureNonDirective(newValue, this._part);
    }
    if (newValue !== this._memoizedValue) {
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;
    } else {
      this._status = CommitStatus.Committed;
    }
    this._pendingValue = newValue;
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedValue != null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(_context: UpdateContext): void {
    const value = this._memoizedValue;

    if (value != null) {
      this._detachListener(value);
      this._memoizedValue = null;
    }

    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        const oldValue = this._memoizedValue;
        const newValue = this._pendingValue;

        // If both old and new are functions, the event listener options are
        // the same. Therefore, there is no need to re-attach the event
        // listener.
        if (
          typeof oldValue === 'object' ||
          typeof newValue === 'object' ||
          oldValue === undefined ||
          newValue === undefined
        ) {
          if (oldValue != null) {
            this._detachListener(oldValue);
          }

          if (newValue != null) {
            this._attachListener(newValue);
          }
        }

        this._memoizedValue = this._pendingValue;
        break;
      }
      case CommitStatus.Unmounting: {
        const value = this._memoizedValue;

        /* istanbul ignore else @preserve */
        if (value != null) {
          this._detachListener(value);
        }

        this._memoizedValue = null;
        break;
      }
    }

    this._status = CommitStatus.Committed;
  }

  handleEvent(event: Event): void {
    const listener = this._memoizedValue!;
    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener.handleEvent(event);
    }
  }

  private _attachListener(listener: EventListenerOrEventListenerObject): void {
    const { node, name } = this._part;

    if (typeof listener === 'function') {
      node.addEventListener(name, this);
    } else {
      node.addEventListener(name, this, listener as AddEventListenerOptions);
    }
  }

  private _detachListener(listener: EventListenerOrEventListenerObject): void {
    const { node, name } = this._part;

    if (typeof listener === 'function') {
      node.removeEventListener(name, this);
    } else {
      node.removeEventListener(name, this, listener as AddEventListenerOptions);
    }
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}

function ensureEventListenerOrNull(
  value: unknown,
  part: Part,
): asserts value is Nullable<EventListenerOrEventListenerObject> {
  if (!isEventListenerOrNull(value)) {
    throw new Error(
      'The value of EventBinding must be EventListener, EventListenerObject, null or undefined.\n' +
        reportPart(part, reportUsedValue(value)),
    );
  }
}

function isEventListenerOrNull(
  value: unknown,
): value is Nullable<EventListenerOrEventListenerObject> {
  return (
    value == null ||
    typeof value === 'function' ||
    (typeof value === 'object' &&
      typeof (value as any)?.handleEvent === 'function')
  );
}
