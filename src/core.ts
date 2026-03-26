import { LinkedList } from './collections/linked-list.js';

export const BOUNDARY_TYPE_ERROR = 0;
export const BOUNDARY_TYPE_HYDRATION = 1;
export const BOUNDARY_TYPE_SHARED_CONTEXT = 2;

export const Template = Symbol('Directive.Template');
export const Primitive = Symbol('Directive.Primitive');

export const Orphan = Symbol('Scope.Orphan');

const toDirective: unique symbol = Symbol('Bindable.toDirective');

export interface Bindable<T extends Directive.Node = Directive.Node> {
  [toDirective](): T;
}

export interface Binding<TValue, TPart = unknown, TRoot = unknown>
  extends ReversibleEffect {
  readonly type: DirectiveType<TValue, TPart, TRoot>;
  value: TValue;
  readonly part: TPart;
  shouldUpdate(value: TValue): boolean;
  attach(session: Session<TRoot>): void;
  detach(session: Session<TRoot>): void;
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

export interface Coroutine<TRoot = unknown> {
  readonly name: string;
  readonly scope: Scope<TRoot>;
  pendingLanes: Lanes;
  start(session: Session<TRoot>): void;
  resume(session: Session<TRoot>): void;
}

export namespace Directive {
  export type Node =
    | Element<unknown>
    | Primitive<unknown>
    | Template<readonly unknown[]>;

  export type Element<TVaue, TPart = unknown, TRoot = unknown> = Directive<
    DirectiveType<TVaue, TPart, TRoot>,
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

export interface DirectiveContext<TRoot = unknown> {
  resolveDirective<TSource, TPart>(
    source: TSource,
    part: TPart,
  ): Directive.Element<UnwrapBindable<TSource>, TPart, TRoot>;
}

export interface DirectiveType<TValue, TPart = unknown, TRoot = unknown> {
  readonly name: string;
  equals?(other: DirectiveType<unknown>): boolean;
  resolveBinding(
    value: TValue,
    part: TPart,
    context: DirectiveContext<TRoot>,
  ): Binding<TValue, TPart, TRoot>;
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

export interface Primitive<TValue, TPart = unknown, TRoot = unknown>
  extends DirectiveType<TValue, TPart, TRoot> {
  ensureValue?(value: unknown, part: TPart): asserts value is TValue;
}

export interface RenderFrame<TRoot = unknown> {
  id: number;
  lanes: Lanes;
  coroutines: Coroutine<TRoot>[];
  mutationEffects: EffectQueue;
  layoutEffects: EffectQueue;
  passiveEffects: EffectQueue;
}

export interface ReversibleEffect extends Effect {
  rollback(): void;
}

export interface Session<TRoot = unknown> {
  root: TRoot;
  frame: RenderFrame<TRoot>;
  scope: Scope<TRoot>;
  coroutine: Coroutine<TRoot>;
  context: SessionContext;
}

export interface SessionContext<TRoot = unknown>
  extends DirectiveContext<TRoot> {
  addObserver(observer: SessionObserver): () => void;
  getScheduledUpdates(): Update<TRoot>[];
  startTransition<T>(action: (transition: number) => T): T;
  nextIdentifier(): string;
  scheduleUpdate(
    coroutine: Coroutine<TRoot>,
    options?: UpdateOptions,
  ): UpdateHandle;
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

export namespace Scope {
  export type Root<TRoot> = Scope<TRoot> & { owner: TRoot };
  export type Child<TRoot> = Scope<TRoot> & { owner: Coroutine<TRoot> };
  export type Orphan<TRoot> = Scope<TRoot> & { owner: typeof Orphan };
}

export class Scope<TRoot = unknown> {
  owner: TRoot | Coroutine<TRoot> | typeof Orphan;
  level: number;
  boundary: Boundary | null = null;

  static readonly Orphan: Scope.Orphan<any> = Object.freeze(
    new Scope(Orphan, 0),
  ) as Scope.Orphan<any>;

  static Root<TRoot>(root: TRoot): Scope.Root<TRoot> {
    return new Scope(root, 0) as Scope.Root<TRoot>;
  }

  static Child<TRoot>(coroutine: Coroutine<TRoot>): Scope.Child<TRoot> {
    return new Scope(
      coroutine,
      coroutine.scope.level + 1,
    ) as Scope.Child<TRoot>;
  }

  private constructor(
    owner: TRoot | Coroutine<TRoot> | typeof Orphan,
    level: number,
  ) {
    this.owner = owner;
    this.level = level;
  }

  getRoot(): Scope.Root<TRoot> | null {
    let currentScope: Scope<TRoot> | undefined = this;
    while (currentScope.level > 0) {
      currentScope = (currentScope.owner as Coroutine<TRoot>).scope;
    }
    return currentScope.owner !== Orphan
      ? (currentScope as Scope.Root<TRoot>)
      : null;
  }

  isChild(): this is Scope.Child<TRoot> {
    return this.level > 0;
  }

  isOrphan(): this is Scope.Orphan<TRoot> {
    return this.owner === Orphan;
  }

  isRoot(): this is Scope.Root<TRoot> {
    return this.owner !== Orphan && this.level === 0;
  }
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export type UnwrapBindable<T> = T extends Bindable<infer Value> ? Value : T;

export interface Update<TRoot> {
  id: number;
  lanes: Lanes;
  coroutine: Coroutine<TRoot>;
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
