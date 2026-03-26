import type {
  DirectiveContext,
  Effect,
  Primitive,
  Session,
} from '../../core.js';
import { PrimitiveBinding } from '../../primitive.js';
import type { Cleanup, Ref, RefObject } from '../../render-context.js';
import { DirectiveError, ensurePartType } from '../error.js';
import { type DOMPart, PART_TYPE_ATTRIBUTE } from '../part.js';
import type { DOMRenderer } from '../template.js';

interface RefHandler<T> {
  pendingRef: Ref<T>;
  currentRef: Ref<T>;
  cleanup: Cleanup | void;
}

export abstract class DOMRef {
  static ensureValue(
    value: unknown,
    part: DOMPart,
  ): asserts value is Ref<Element> {
    if (!isRef(value)) {
      throw new DirectiveError(
        DOMRef,
        value,
        part,
        'Ref values must be function, object, null or undefined.',
      );
    }
  }

  static resolveBinding(
    value: Ref<Element>,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMRefBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_ATTRIBUTE, DOMRef, value, part);
    }
    return new DOMRefBinding(value, part);
  }
}

export class DOMRefBinding extends PrimitiveBinding<
  Ref<Element>,
  DOMPart.Attribute,
  DOMRenderer
> {
  private _handler: RefHandler<Element> = {
    pendingRef: null,
    currentRef: null,
    cleanup: undefined,
  };

  get type(): Primitive<Ref<Element>, DOMPart.Attribute> {
    return DOMRef;
  }

  shouldUpdate(newRef: Ref<Element>): boolean {
    return newRef !== this._handler.currentRef;
  }

  override attach(session: Session): void {
    session.frame.layoutEffects.pushBefore(
      new InvokeRef(this._handler, this._part),
    );
    this._handler.pendingRef = this._pendingValue;
  }

  override detach(session: Session): void {
    session.frame.mutationEffects.pushAfter(new CleanupRef(this._handler));
    this._handler.pendingRef = null;
  }
}

class CleanupRef implements Effect {
  private readonly _handler: RefHandler<Element>;

  constructor(handler: RefHandler<Element>) {
    this._handler = handler;
  }

  commit(): void {
    const ref = this._handler.currentRef;

    if (ref != null) {
      if (typeof ref === 'function') {
        const { cleanup } = this._handler;
        cleanup?.();
        this._handler.cleanup = undefined;
      } else {
        ref.current = null;
      }
    }
  }
}

class InvokeRef implements Effect {
  private readonly _handler: RefHandler<Element>;

  private readonly _part: DOMPart.Attribute;

  constructor(handler: RefHandler<Element>, part: DOMPart.Attribute) {
    this._handler = handler;
    this._part = part;
  }

  commit(): void {
    const newRef = this._handler.pendingRef;
    const oldRef = this._handler.currentRef;

    if (newRef !== oldRef) {
      const element = this._part.node;

      if (typeof oldRef === 'function') {
        const { cleanup } = this._handler;
        cleanup?.();
        this._handler.cleanup = undefined;
      } else if (oldRef != null) {
        oldRef.current = null;
      }

      if (typeof newRef === 'function') {
        this._handler.cleanup = newRef(element);
      } else if (newRef != null) {
        newRef.current = element;
      }
    }

    this._handler.pendingRef = null;
    this._handler.currentRef = newRef;
  }
}

function isRef(value: unknown): value is Ref<unknown> {
  return (
    value == null ||
    typeof value === 'function' ||
    (value as RefObject<unknown>).current !== undefined
  );
}
