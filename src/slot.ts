import {
  type Directive,
  type DirectiveHandler,
  type Effect,
  type Lanes,
  Primitive,
  type PrimitiveHandler,
  Repeat,
  type Scope,
  type Session,
  type UpdateUnit,
} from './core.js';
import { AbortError, InterruptError } from './error.js';
import {
  containsScope,
  createChildScope,
  handleError,
  OrphanScope,
} from './scope.js';

const IdleStatus = 0;
const StagedStatus = 1;
const StaleStatus = 2;

type SlotStatus = typeof IdleStatus | typeof StagedStatus | typeof StaleStatus;

export class Slot<TPart = unknown, TRenderer = unknown>
  implements UpdateUnit<TPart, TRenderer>, Effect
{
  private readonly _part: TPart;
  private _directive: Directive.ElementDirective;
  private _scope: Scope<TPart, TRenderer>;
  private _pendingLanes: Lanes = 0;
  private _handler: DirectiveHandler<unknown> | null = null;
  private _snapshot: Slot<TPart, TRenderer> | null = null;
  private _status: SlotStatus = IdleStatus;

  constructor(
    part: TPart,
    directive: Directive.ElementDirective,
    scope: Scope<TPart, TRenderer>,
    pendingLanes: Lanes = 0,
    handler: DirectiveHandler<unknown> | null = null,
    snapshot: Slot<TPart, TRenderer> | null = null,
  ) {
    this._part = part;
    this._directive = directive;
    this._scope = scope;
    this._pendingLanes = pendingLanes;
    this._handler = handler;
    this._snapshot = snapshot;
  }

  get part(): TPart {
    return this._part;
  }

  get directive(): Directive.ElementDirective {
    return this._directive;
  }

  get scope(): Scope<TPart, TRenderer> {
    return this._scope;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  set pendingLanes(lanes: Lanes) {
    this._pendingLanes = lanes;
  }

  clone(): Slot<TPart, TRenderer> {
    return new Slot(
      this._part,
      this._directive,
      this._scope,
      this._pendingLanes,
      this._handler,
      this._snapshot,
    );
  }

  needsRender(): boolean {
    return (
      this._snapshot === null ||
      this._handler === null ||
      this._handler.shouldUpdate(
        this._directive.value,
        this._snapshot._directive.value,
      )
    );
  }

  update(
    directive: Directive.ElementDirective,
    scope: Scope<TPart, TRenderer>,
  ): Slot<TPart, TRenderer> {
    const alternate = this._snapshot?.clone() ?? this;

    alternate._directive = directive;
    alternate._scope = scope;
    alternate._handler =
      directive.type === alternate._directive.type &&
      directive.key === alternate._directive.key
        ? alternate._handler
        : null;

    return alternate;
  }

  *start(session: Session<TPart, TRenderer>): Generator<Slot> {
    yield this;
    session.mutationEffects.push(this);
  }

  *render(session: Session<TPart, TRenderer>): Generator<UpdateUnit> {
    const { type, value } = this._directive;
    const { adapter, lanes } = session;

    if (type === Primitive) {
      this._handler ??= adapter.resolvePrimitive(this._directive, this._part);
      (this._handler as PrimitiveHandler<unknown>).ensureValue(
        value,
        this._part,
      );
    } else if (type === Repeat) {
      this._handler ??= adapter.resolveRepeat(this._directive, this._part);
    } else if (typeof type === 'object') {
      this._handler ??= adapter.resolveTemplate(this._directive, this._part);
    } else {
      this._handler ??= this._directive.type.resolveComponent(
        this._directive,
        this._part,
      );
    }

    if (this._snapshot !== null && this._handler !== this._snapshot._handler) {
      this._snapshot.discard(session);
    }

    while (true) {
      const scope = createChildScope(this);
      let childUnits: Iterable<UpdateUnit>;

      this._pendingLanes &= ~lanes;

      try {
        childUnits = this._handler.render(value, this._part, scope, session);
      } catch (error) {
        let handlingScope: Scope;
        try {
          handlingScope = handleError(this._scope, error);
        } catch (error) {
          throw new AbortError(scope, 'An error occurred during rendering.', {
            cause: error,
          });
        }
        if (Object.isFrozen(handlingScope)) {
          throw new InterruptError(
            scope,
            'An error was captured by an error boundary outside origin scope.',
          );
        }
        childUnits = [];
      }

      if ((this._pendingLanes & lanes) === 0) {
        for (const childUnit of childUnits) {
          if (childUnit.needsRender()) {
            yield childUnit;
          }
        }
      }

      Object.freeze(scope);

      if ((this._pendingLanes & lanes) === 0) {
        this._handler.complete(value, this._part, scope, session);
        break;
      }

      restartRender(session, scope);
    }

    this._status = StagedStatus;
  }

  discard(session: Session<TPart, TRenderer>): void {
    this._handler?.discard(
      this._directive.value,
      this._part,
      this._scope,
      session,
    );
    this._scope = OrphanScope;
    this._status = StaleStatus;
  }

  commit(): void {
    if (this._status === StagedStatus) {
      if (
        this._snapshot !== null &&
        this._handler !== this._snapshot._handler
      ) {
        this._snapshot.revert();
      }
      const newValue = this._directive.value;
      const oldValue = this._snapshot?._directive.value ?? null;
      this._handler?.mount(newValue, oldValue, this._part);
      this._status = IdleStatus;
      this._snapshot = this;
    }
  }

  revert(): void {
    if (this._status === StaleStatus) {
      this._handler?.unmount(this._directive.value, this._part);
      this._handler = null;
      this._status = IdleStatus;
      this._snapshot = null;
    }
  }
}

function invalidateEffects(effects: Effect[], scope: Scope): void {
  const index = lowerBound(effects, (effect) =>
    containsScope(scope, effect.scope) ? 1 : -1,
  );
  effects.splice(index);
}

function lowerBound<T>(xs: readonly T[], compare: (x: T) => number): number {
  let low = 0;
  let high = xs.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(xs[mid]!) < 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function restartRender(session: Session, scope: Scope): void {
  invalidateEffects(session.mutationEffects, scope);
  invalidateEffects(session.layoutEffects, scope);
  invalidateEffects(session.passiveEffects, scope);
}
