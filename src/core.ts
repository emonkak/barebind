import { LinkedList } from './collections/linked-list.js';

export const BOUNDARY_TYPE_ERROR = 0;
export const BOUNDARY_TYPE_SHARED_CONTEXT = 1;

export const Template = Symbol('Directive.Template');
export const Primitive = Symbol('Directive.Primitive');

const Root = Symbol('Scope.Root');
const Orphan = Symbol('Scope.Orphan');

const toDirective: unique symbol = Symbol('Bindable.toDirective');

export interface Bindable<T extends Directive.Node = Directive.Node> {
  [toDirective](): T;
}

export interface Binding<TValue, TPart = unknown, TRenderer = unknown>
  extends ReversibleEffect {
  readonly type: DirectiveType<TValue, TPart, TRenderer>;
  value: TValue;
  readonly part: TPart;
  shouldUpdate(newValue: TValue): boolean;
  attach(session: Session<TPart, TRenderer>): void;
  detach(session: Session<TPart, TRenderer>): void;
}

export type Boundary = Boundary.ErrorBoundary | Boundary.SharedContextBoundary;

export namespace Boundary {
  export interface ErrorBoundary {
    type: typeof BOUNDARY_TYPE_ERROR;
    next: Boundary | null;
    handler: ErrorHandler;
  }

  export interface SharedContextBoundary {
    type: typeof BOUNDARY_TYPE_SHARED_CONTEXT;
    next: Boundary | null;
    key: unknown;
    value: unknown;
  }
}

export type CommitPhase = 'mutation' | 'layout' | 'passive';

export interface Coroutine<TPart = unknown, TRenderer = unknown> {
  readonly name: string;
  readonly scope: Scope;
  pendingLanes: Lanes;
  start(session: Session<TPart, TRenderer>): void;
  resume(session: Session<TPart, TRenderer>): void;
}

export namespace Directive {
  export type Node =
    | Element<unknown>
    | Primitive<unknown>
    | Template<readonly unknown[]>;

  export type Element<TVaue, TPart = unknown, TRenderer = unknown> = Directive<
    DirectiveType<TVaue, TPart, TRenderer>,
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

export interface DirectiveContext<TPart = unknown, TRenderer = unknown> {
  resolveDirective<TSource, TBindingPart extends TPart>(
    source: TSource,
    part: TBindingPart,
  ): Directive.Element<UnwrapBindable<TSource>, TBindingPart, TRenderer>;
}

export interface DirectiveType<TValue, TPart = unknown, TRenderer = unknown> {
  readonly name: string;
  resolveBinding(
    value: TValue,
    part: TPart,
    context: DirectiveContext<TPart, TRenderer>,
  ): Binding<TValue, TPart, TRenderer>;
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

export interface Primitive<TValue, TPart = unknown, TRenderer = unknown>
  extends DirectiveType<TValue, TPart, TRenderer> {
  ensureValue?(value: unknown, part: TPart): asserts value is TValue;
}

export interface RenderFrame<TPart = unknown, TRenderer = unknown> {
  id: number;
  lanes: Lanes;
  coroutines: Coroutine<TPart, TRenderer>[];
  mutationEffects: EffectQueue;
  layoutEffects: EffectQueue;
  passiveEffects: EffectQueue;
}

export interface ReversibleEffect extends Effect {
  rollback(): void;
}

export interface Session<TPart = unknown, TRenderer = unknown> {
  renderer: TRenderer;
  frame: RenderFrame<TPart, TRenderer>;
  scope: Scope;
  coroutine: Coroutine<TPart, TRenderer>;
  context: SessionContext<TPart, TRenderer>;
}

export interface SessionContext<TPart = unknown, TRenderer = unknown>
  extends DirectiveContext<TPart, TRenderer> {
  addObserver(observer: SessionObserver): () => void;
  getScheduledUpdates(): Update<TPart, TRenderer>[];
  startTransition<T>(action: (transition: number) => T): T;
  nextIdentifier(): string;
  scheduleUpdate(
    coroutine: Coroutine<TPart, TRenderer>,
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
  export type Root = Scope<typeof Root>;
  export type Child = Scope<Coroutine>;
  export type Orphan = Scope<typeof Orphan>;
}

export class Scope<TOwner = unknown> {
  owner: TOwner;
  level: number;
  boundary: Boundary | null = null;

  static readonly Orphan: Scope.Orphan = Object.freeze(new Scope(Orphan, 0));

  static Child(coroutine: Coroutine): Scope.Child {
    return new Scope(coroutine, coroutine.scope.level + 1);
  }

  static Root(): Scope.Root {
    return new Scope(Root, 0);
  }

  private constructor(owner: TOwner, level: number) {
    this.owner = owner;
    this.level = level;
  }

  getPendingAncestor(lanes: Lanes): Scope.Child | null {
    let currentScope: Scope | undefined = this;
    while (currentScope.level > 0) {
      const coroutine = currentScope.owner as Coroutine;
      if ((coroutine.pendingLanes & lanes) === lanes) {
        return currentScope as Scope.Child;
      }
      currentScope = coroutine.scope;
    }
    return null;
  }

  isChild(): this is Scope.Child {
    return this.level > 0;
  }

  isOrphan(): this is Scope.Orphan {
    return this.owner === Orphan;
  }

  isRoot(): this is Scope.Root {
    return this.owner === Root;
  }
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export type UnwrapBindable<T> = T extends Bindable<infer Value> ? Value : T;

export interface Update<TPart, TRenderer> {
  id: number;
  lanes: Lanes;
  coroutine: Coroutine<TPart, TRenderer>;
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

export function isBindable(value: unknown): value is Bindable<any> {
  return typeof (value as Bindable)?.[toDirective] === 'function';
}

export function toDirectiveNode(source: unknown): Directive.Node {
  return isBindable(source)
    ? source[toDirective]()
    : new Directive(Primitive, source);
}
