/// <reference path="../typings/scheduler.d.ts" />

import type { LinkedList } from './collections/linked-list.js';
import { AbortError, handleError, InterruptError } from './error.js';
import { containsScope, createChildScope, OrphanScope } from './scope.js';

export const ErrorBoundary = 0;
export const SharedContextBoundary = 1;

export const NoLanes: Lanes /*           */ = 0;
export const AllLanes: Lanes /*          */ = -1;
export const SyncLane: Lane /*           */ = 0b0000000000000001;
export const ViewTransitionLane: Lane /* */ = 0b0000000000000010;
export const ConcurrentLane: Lane /*     */ = 0b0000000000000100;
export const UserBlockingLane: Lane /*   */ = 0b0000000000001000;
export const UserVisibleLane: Lane /*    */ = 0b0000000000010000;
export const BackgroundLane: Lane /*     */ = 0b0000000000100000;
export const TransitionLanes: Lanes /*   */ = 0b11111111111111110000000000000000;
export const TransitionLane1: Lane /*    */ = 0b00000000000000010000000000000000;
export const TransitionLength: number /* */ = 16;

export const MutationPhase /* */ = 0b001;
export const LayoutPhase /*   */ = 0b010;
export const PassivePhase /*  */ = 0b100;

const Repeat = Symbol('Repeat');
const Primitive = Symbol('Primitive');

const IdleStatus = 0;
const StagedStatus = 1;
const StaleStatus = 2;

type SlotStatus = typeof IdleStatus | typeof StagedStatus | typeof StaleStatus;

export type Boundary = Boundary.ErrorBoundary | Boundary.SharedContextBoundary;

export namespace Boundary {
  export interface ErrorBoundary {
    type: typeof ErrorBoundary;
    next: Boundary | null;
    handler: ErrorHandler;
  }

  export interface SharedContextBoundary {
    type: typeof SharedContextBoundary;
    next: Boundary | null;
    key: unknown;
    value: unknown;
  }
}

export interface Component<TProps> {
  resolveComponent(
    directive: Directive.ComponentDirective<TProps>,
  ): DirectiveHandler<TProps>;
  (props: TProps): Directive.ComponentDirective<TProps>;
}

export namespace Directive {
  export type ElementDirective =
    | ComponentDirective<unknown>
    | PrimitiveDirective<unknown>
    | RepeatDirective<unknown>
    | TemplateDirective;

  export type ComponentDirective<TProps> = Directive<Component<TProps>, TProps>;

  export type PrimitiveDirective<TValue> = Directive<typeof Primitive, TValue>;

  export type RepeatDirective<TSource> = Directive<
    typeof Repeat,
    Iterable<TSource>
  >;

  export type TemplateDirective = Directive<readonly string[], Template>;
}

export interface DirectiveHandler<
  TValue,
  TPart = unknown,
  TRenderer = unknown,
> {
  shouldUpdate(newValue: TValue, oldValue: TValue): boolean;
  render(
    value: TValue,
    part: TPart,
    scope: Scope.ChildScope<TPart, TRenderer>,
    session: Session<TPart, TRenderer>,
  ): Iterable<Slot>;
  complete(
    value: TValue,
    part: TPart,
    scope: Scope<TPart, TRenderer>,
    session: Session<TPart, TRenderer>,
  ): void;
  discard(
    value: TValue,
    part: TPart,
    scope: Scope<TPart, TRenderer>,
    session: Session<TPart, TRenderer>,
  ): void;
  commit(oldValue: TValue, newValue: TValue | null, part: TPart): void;
  revert(value: TValue, part: TPart): void;
}

export interface Effect {
  scope: Scope;
  commit(): void;
}

export type EffectPhase =
  | typeof MutationPhase
  | typeof LayoutPhase
  | typeof PassivePhase;

export type EffectPhases = number;

export type ErrorHandler = (
  error: unknown,
  handleError: (error: unknown) => void,
) => void;

export interface HostAdapter<TPart, TRenderer> {
  getCommitPhases(): EffectPhases;
  getDefaultLanes(): Lanes;
  getIdentifier(): string;
  getTaskPriority(): TaskPriority;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: SchedulerPostTaskOptions,
  ): Promise<T>;
  requestRenderer(scope: Scope): TRenderer;
  resolvePrimitive(
    directive: Directive.PrimitiveDirective<unknown>,
    part: TPart,
  ): PrimitiveHandler<unknown, TPart, TRenderer>;
  resolveRepeat(
    directive: Directive.RepeatDirective<unknown>,
    part: TPart,
  ): DirectiveHandler<Iterable<unknown>, TPart, TRenderer>;
  resolveTemplate(
    directive: Directive.TemplateDirective,
    part: TPart,
  ): DirectiveHandler<Template, TPart, TRenderer>;
  startViewTransition(callback: () => PromiseLike<void> | void): Promise<void>;
  yieldToMain(): Promise<void>;
}

export type Lane = number;

export type Lanes = number;

export interface Root<TPart> {
  part: TPart;
  idPrefix: string;
  idSeq: number;
}

export interface PrimitiveHandler<TValue, TPart = unknown, TRenderer = unknown>
  extends DirectiveHandler<TValue, TPart, TRenderer> {
  ensureValue(value: unknown): void;
}

export interface Update<TPart, TRenderer> {
  id: number;
  lanes: Lanes;
  task: UpdateTask<TPart, TRenderer>;
  controller: PromiseWithResolvers<UpdateResult>;
}

export interface UpdateHandle {
  id: number;
  lanes: Lanes;
  scheduled: Promise<UpdateResult>;
  finished: Promise<UpdateResult>;
}

export interface UpdateOptions extends SchedulerPostTaskOptions {
  flushSync?: boolean;
  immediate?: boolean;
  transition?: number;
  triggerFlush?: boolean;
  viewTransition?: boolean;
}

export type UpdateResult =
  | { status: 'done' }
  | { status: 'skipped' }
  | { status: 'aborted'; reason: unknown };

export interface UpdateScheduler<TPart = unknown, TRenderer = unknown> {
  get updateQueue(): LinkedList<Update<TPart, TRenderer>>;
  nextTransition(): number;
  observe(observer: SessionObserver): () => void;
  schedule(task: UpdateTask, options?: UpdateOptions): UpdateHandle;
}

export interface UpdateTask<TPart = unknown, TRenderer = unknown> {
  readonly scope: Scope<TPart, TRenderer>;
  readonly pendingLanes: Lanes;
  start(session: Session<TPart, TRenderer>): Generator<Slot>;
}

export type Scope<TPart = unknown, TRenderer = unknown> =
  | Scope.ChildScope<TPart, TRenderer>
  | Scope.OrphanScope
  | Scope.RootScope<TPart>;

export namespace Scope {
  export type ChildScope<TPart = unknown, TRenderer = unknown> = {
    owner: Slot<TPart, TRenderer>;
    level: number;
    boundary: Boundary | null;
  };

  export type RootScope<TPart = unknown> = {
    owner: Root<TPart>;
    level: 0;
    boundary: Boundary | null;
  };

  export type OrphanScope = {
    owner: null;
    level: 0;
    boundary: null;
  };
}

export interface Session<TPart = unknown, TRenderer = unknown> {
  id: number;
  lanes: Lanes;
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
  adapter: HostAdapter<TPart, TRenderer>;
  renderer: TRenderer;
  scheduler: UpdateScheduler<TPart, TRenderer>;
}

export type SessionEvent =
  | {
      type: 'render-start' | 'render-end';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'render-error';
      id: number;
      error: unknown;
      captured: boolean;
    }
  | {
      type: 'slot-render-start' | 'slot-render-end';
      id: number;
      slot: Slot;
    }
  | {
      type: 'commit-start' | 'commit-end';
      id: number;
    }
  | {
      type: 'commit-abort';
      id: number;
      reason: unknown;
    }
  | {
      type: 'effect-commit-start' | 'effect-commit-end';
      id: number;
      phase: EffectPhase;
      effects: Effect[];
    };

export interface SessionObserver {
  onSessionEvent(event: SessionEvent): void;
}

export interface Template {
  strings: readonly string[];
  exprs: readonly unknown[];
  mode: TemplateMode;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export class Directive<TType, TValue> {
  readonly type: TType;
  readonly value: TValue;
  readonly key: unknown;

  constructor(type: TType, value: TValue, key?: unknown) {
    this.type = type;
    this.value = value;
    this.key = key;
  }

  withKey(key: unknown): Directive<TType, TValue> {
    return new Directive(this.type, this.value, key);
  }
}

export class Slot<TPart = unknown, TRenderer = unknown>
  implements UpdateTask<TPart, TRenderer>, Effect
{
  private readonly _part: TPart;
  private _directive: Directive.ElementDirective;
  private _scope: Scope<TPart, TRenderer>;
  private _pendingLanes: Lanes = NoLanes;
  private _handler: DirectiveHandler<unknown> | null = null;
  private _snapshot: Slot<TPart, TRenderer> | null = null;
  private _status: SlotStatus = IdleStatus;

  constructor(
    part: TPart,
    directive: Directive.ElementDirective,
    scope: Scope<TPart, TRenderer>,
    pendingLanes: Lanes = NoLanes,
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

  shouldUpdate(lanes: Lanes): boolean {
    return (
      (this._pendingLanes & lanes) !== NoLanes ||
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

  *render(session: Session<TPart, TRenderer>): Generator<Slot> {
    const { type, value } = this._directive;
    const { adapter } = session;

    if (type === Primitive) {
      this._handler ??= adapter.resolvePrimitive(this._directive, this._part);
      (this._handler as PrimitiveHandler<unknown>).ensureValue(value);
    } else if (type === Repeat) {
      this._handler ??= adapter.resolveRepeat(this._directive, this._part);
    } else if (typeof type === 'object') {
      this._handler ??= adapter.resolveTemplate(this._directive, this._part);
    } else {
      this._handler ??= this._directive.type.resolveComponent(this._directive);
    }

    if (this._snapshot !== null && this._handler !== this._snapshot._handler) {
      this._snapshot.discard(session);
    }

    while (true) {
      const scope = createChildScope(this);
      let childSlots: Iterable<Slot>;

      this._pendingLanes &= ~session.lanes;

      try {
        childSlots = this._handler.render(value, this._part, scope, session);
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
        childSlots = [];
      }

      if ((this._pendingLanes & session.lanes) === NoLanes) {
        for (const childSlot of childSlots) {
          if (childSlot.shouldUpdate(session.lanes)) {
            yield childSlot;
          }
        }
      }

      Object.freeze(scope);

      if ((this._pendingLanes & session.lanes) === NoLanes) {
        break;
      }

      restartRender(session, scope);
    }

    this._handler.complete(value, this._part, this._scope, session);

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
      this._handler?.commit(newValue, oldValue, this._part);
    }
    this._status = IdleStatus;
    this._snapshot = this;
  }

  revert(): void {
    if (this._status === StaleStatus) {
      this._handler?.revert(this._directive.value, this._part);
      this._handler = null;
    }
    this._status = IdleStatus;
    this._snapshot = null;
  }
}

export function wrap(value: unknown): Directive.ElementDirective {
  return value instanceof Directive
    ? value
    : typeof value === 'object' && isIterable(value)
      ? new Directive(Repeat, value)
      : new Directive(Primitive, value);
}

export function getPriorityFromLanes(lanes: Lanes): TaskPriority | null {
  if (lanes & BackgroundLane) {
    return 'background';
  } else if (lanes & UserVisibleLane) {
    return 'user-visible';
  } else if (lanes & UserBlockingLane) {
    return 'user-blocking';
  } else {
    return null;
  }
}

export function getRenderLanes(options: UpdateOptions): Lanes {
  let lanes = 0;

  if (options.flushSync) {
    lanes |= SyncLane;
  }

  if (options.viewTransition) {
    lanes |= ViewTransitionLane;
  }

  switch (options.priority) {
    case 'user-blocking':
      lanes |= UserBlockingLane;
      break;
    case 'user-visible':
      lanes |= UserVisibleLane;
      break;
    case 'background':
      lanes |= BackgroundLane;
      break;
  }

  if (options.transition !== undefined) {
    lanes |= TransitionLane1 << (options.transition % TransitionLength);
  }

  return lanes;
}

export function getTranstionIndex(lanes: Lanes): number {
  return 31 - Math.clz32(lanes >>> TransitionLength);
}

function invalidateEffects(effects: Effect[], scope: Scope): void {
  const index = effects.findLastIndex(
    (effect) => !containsScope(scope, effect.scope),
  );
  effects.splice(index + 1);
}

function isIterable(value: any): value is Iterable<unknown> {
  return typeof value?.[Symbol.iterator] === 'function';
}

function restartRender(session: Session, scope: Scope): void {
  invalidateEffects(session.mutationEffects, scope);
  invalidateEffects(session.layoutEffects, scope);
  invalidateEffects(session.passiveEffects, scope);
}
