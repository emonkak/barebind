/// <reference path="../typings/scheduler.d.ts" />

export const Repeat = Symbol('Repeat');
export const Primitive = Symbol('Primitive');

export const ErrorBoundary = 0;
export const SharedContextBoundary = 1;

export const MutationPhase /* */ = 0b001;
export const LayoutPhase /*   */ = 0b010;
export const PassivePhase /*  */ = 0b100;

export type Boundary = Boundary.ErrorBoundary | Boundary.SharedContextBoundary;

export const toDirective: unique symbol = Symbol('Directive.toDirective');

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
    part: unknown,
  ): DirectiveHandler<TProps>;
  (props: TProps): Directive.ComponentDirective<TProps>;
}

export interface Directable {
  [toDirective](): Directive.ElementDirective;
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
  ): Iterable<UpdateUnit>;
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
  mount(oldValue: TValue, newValue: TValue | null, part: TPart): void;
  unmount(value: TValue, part: TPart): void;
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

export interface ErrorHandler {
  handleError(error: unknown, forwardError: (error: unknown) => void): void;
}

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
  get adapter(): HostAdapter<TPart, TRenderer>;
  get updateQueue(): Iterable<Update<TPart, TRenderer>>;
  nextTransition(): number;
  schedule(task: UpdateTask, options?: UpdateOptions): UpdateHandle;
}

export interface UpdateTask<TPart = unknown, TRenderer = unknown> {
  readonly scope: Scope<TPart, TRenderer>;
  readonly pendingLanes: Lanes;
  start(session: Session<TPart, TRenderer>): Generator<UpdateUnit>;
}

export interface UpdateUnit<TPart = unknown, TRenderer = unknown>
  extends UpdateTask {
  readonly part: TPart;
  readonly directive: Directive.ElementDirective;
  readonly scope: Scope<TPart, TRenderer>;
  pendingLanes: Lanes;
  needsRender(lanes: Lanes): boolean;
  render(session: Session<TPart, TRenderer>): Generator<UpdateUnit>;
}

export type Scope<TPart = unknown, TRenderer = unknown> =
  | Scope.ChildScope<TPart, TRenderer>
  | Scope.OrphanScope
  | Scope.RootScope<TPart>;

export namespace Scope {
  export type ChildScope<TPart = unknown, TRenderer = unknown> = {
    owner: UpdateUnit<TPart, TRenderer>;
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

export interface Template {
  strings: readonly string[];
  exprs: readonly unknown[];
  mode: TemplateMode;
}

export type TemplateMode = 'html' | 'math' | 'svg' | 'textarea';

export class Directive<TType, TValue> implements Directable {
  readonly type: TType;
  readonly value: TValue;
  readonly key: unknown;

  constructor(type: TType, value: TValue, key?: unknown) {
    this.type = type;
    this.value = value;
    this.key = key;
  }

  [toDirective](this: Directive.ElementDirective): Directive.ElementDirective {
    return this;
  }

  withKey(key: unknown): Directive<TType, TValue> {
    return new Directive(this.type, this.value, key);
  }
}

export function wrap(value: unknown): Directive.ElementDirective {
  return isDirectable(value)
    ? value[toDirective]()
    : typeof value === 'object' && isIterable(value)
      ? new Directive(Repeat, value)
      : new Directive(Primitive, value);
}

function isDirectable(value: any): value is Directable {
  return typeof value?.[toDirective] === 'function';
}

function isIterable(value: any): value is Iterable<unknown> {
  return typeof value?.[Symbol.iterator] === 'function';
}
