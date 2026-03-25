import { LinkedList } from './collections/linked-list.js';

export const BOUNDARY_TYPE_ERROR = 0;
export const BOUNDARY_TYPE_HYDRATION = 1;
export const BOUNDARY_TYPE_SHARED_CONTEXT = 2;

export const Template = Symbol('Directive.Template');
export const Primitive = Symbol('Directive.Primitive');

const toDirective: unique symbol = Symbol('Bindable.toDirective');

export interface Bindable<T extends Directive.Node = Directive.Node> {
  [toDirective](): T;
}

export interface Binding<TValue, TPart = unknown> extends ReversibleEffect {
  readonly type: DirectiveType<TValue, TPart>;
  value: TValue;
  readonly part: TPart;
  shouldUpdate(value: TValue): boolean;
  attach(session: Session): void;
  detach(session: Session): void;
}

export type Boundary =
  | Boundary.ErrorBoundary
  | Boundary.HydrationBoundary
  | Boundary.SharedContextBoundary;

export namespace Boundary {
  export interface ErrorBoundary {
    type: typeof BOUNDARY_TYPE_ERROR;
    next: Boundary | null;
    handler: ErrorHandler;
  }

  export interface HydrationBoundary {
    type: typeof BOUNDARY_TYPE_HYDRATION;
    next: Boundary | null;
    target: TreeWalker;
  }

  export interface SharedContextBoundary {
    type: typeof BOUNDARY_TYPE_SHARED_CONTEXT;
    next: Boundary | null;
    key: unknown;
    value: unknown;
  }
}

export type CommitPhase = 'mutation' | 'layout' | 'passive';

export interface Coroutine {
  readonly name: string;
  readonly scope: Scope;
  pendingLanes: Lanes;
  start(session: Session): void;
  resume(session: Session): void;
}

export namespace Directive {
  export type Node =
    | Element<unknown>
    | Primitive<unknown>
    | Template<readonly unknown[]>;

  export type Element<TVaue, TPart = unknown> = Directive<
    DirectiveType<TVaue, TPart>,
    TVaue
  >;

  export type Primitive<TValue> = Directive<typeof Primitive, TValue>;

  export type Template<TExprs extends readonly unknown[]> = Directive<
    typeof Template,
    { strings: readonly string[]; exprs: TExprs; mode: TemplateMode }
  >;
}

export class Directive<TType, TValue> {
  static readonly toDirective: typeof toDirective = toDirective;

  readonly type: TType;

  readonly value: TValue;

  readonly key: unknown;

  constructor(type: TType, value: TValue, key?: unknown) {
    this.type = type;
    this.value = value;
    this.key = key;
    DEBUG: {
      Object.freeze(this);
    }
  }

  [toDirective](): Directive<TType, TValue> {
    return this;
  }

  withKey(key: unknown): Directive<TType, TValue> {
    return new Directive(this.type, this.value, key);
  }
}

export interface DirectiveContext {
  resolveDirective<TSource, TPart>(
    source: TSource,
    part: TPart,
  ): Directive.Element<UnwrapBindable<TSource>, TPart>;
}

export interface DirectiveType<TValue, TPart = unknown> {
  readonly name: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(
    value: TValue,
    part: TPart,
    context: DirectiveContext,
  ): Binding<TValue, TPart>;
}

export interface Effect {
  commit(): void;
}

export class EffectQueue {
  private _headEffects: LinkedList<Effect> = new LinkedList();

  private _middleEffects: LinkedList<Effect> = new LinkedList();

  private _tailEffects: LinkedList<Effect> = new LinkedList();

  private _lastLevel = 0;

  private _size = 0;

  get size(): number {
    return this._size;
  }

  clear(): void {
    this._headEffects.clear();
    this._middleEffects.clear();
    this._tailEffects.clear();
    this._lastLevel = 0;
    this._size = 0;
  }

  flush(): void {
    try {
      for (const effect of this._headEffects) {
        effect.commit();
      }
      for (const effect of this._middleEffects) {
        effect.commit();
      }
      for (const effect of this._tailEffects) {
        effect.commit();
      }
    } finally {
      this.clear();
    }
  }

  push(effect: Effect, level: number): void {
    if (level > this._lastLevel) {
      this._tailEffects = LinkedList.concat(
        this._middleEffects,
        this._tailEffects,
      );
    } else if (level < this._lastLevel) {
      this._headEffects = LinkedList.concat(
        this._headEffects,
        this._middleEffects,
        this._tailEffects,
      );
    }
    this._middleEffects.pushBack(effect);
    this._lastLevel = level;
    this._size++;
  }

  pushAfter(effect: Effect): void {
    this._tailEffects.pushBack(effect);
    this._size++;
  }

  pushBefore(effect: Effect): void {
    this._headEffects.pushBack(effect);
    this._size++;
  }
}

export type ErrorHandler = (
  error: unknown,
  handleError: (error: unknown) => void,
) => void;

export type Lane = number;

export type Lanes = number;

export interface Primitive<TValue, TPart = unknown>
  extends DirectiveType<TValue, TPart> {
  ensureValue?(value: unknown, part: TPart): asserts value is TValue;
}

export interface RenderFrame {
  id: number;
  lanes: Lanes;
  coroutines: Coroutine[];
  mutationEffects: EffectQueue;
  layoutEffects: EffectQueue;
  passiveEffects: EffectQueue;
}

export interface ReversibleEffect extends Effect {
  rollback(): void;
}

export interface Session {
  frame: RenderFrame;
  scope: Scope;
  coroutine: Coroutine;
  context: SessionContext;
}

export interface SessionContext extends DirectiveContext {
  addObserver(observer: SessionObserver): () => void;
  getScheduledUpdates(): Update[];
  startTransition<T>(action: (transition: number) => T): T;
  nextIdentifier(): string;
  scheduleUpdate(coroutine: Coroutine, options?: UpdateOptions): UpdateHandle;
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
      type: 'coroutine-start' | 'coroutine-end';
      id: number;
      coroutine: Coroutine;
    }
  | {
      type: 'commit-start' | 'commit-end';
      id: number;
    }
  | {
      type: 'commit-cancel';
      id: number;
      reason: unknown;
    }
  | {
      type: 'effect-commit-start' | 'effect-commit-end';
      id: number;
      phase: CommitPhase;
      effects: EffectQueue;
    };

export interface SessionObserver {
  onSessionEvent(event: SessionEvent): void;
}

export class Scope {
  owner: Coroutine | null;
  level: number;
  boundary: Boundary | null;

  static Detached: Scope = Object.freeze(new Scope());

  constructor(owner: Coroutine | null = null) {
    this.owner = owner;
    this.level = owner !== null ? owner.scope.level + 1 : 0;
    this.boundary = null;
  }
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export type UnwrapBindable<T> = T extends Bindable<infer Value> ? Value : T;

export interface Update {
  id: number;
  lanes: Lanes;
  coroutine: Coroutine;
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
  | { status: 'canceled'; reason: unknown };

export function areDirectiveTypesEqual(
  nextType: DirectiveType<unknown>,
  prevType: DirectiveType<unknown>,
): boolean {
  return nextType.equals?.(prevType) ?? nextType === prevType;
}

export function isBindable(value: unknown): value is Bindable<any> {
  return typeof (value as Bindable)?.[toDirective] === 'function';
}

export function toDirectiveNode(source: unknown): Directive.Node {
  return isBindable(source)
    ? source[toDirective]()
    : new Directive(Primitive, source);
}
