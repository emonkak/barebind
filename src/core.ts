/// <reference path="../typings/scheduler.d.ts" />

export const Repeat = Symbol('Repeat');
export const Primitive = Symbol('Primitive');

export const MutationPhase /* */ = 0b001;
export const LayoutPhase /*   */ = 0b010;
export const PassivePhase /*  */ = 0b100;

export const toDirective: unique symbol = Symbol('Directive.toDirective');

export interface Boundary<T> {
  instance: T;
  next: Boundary<unknown> | null;
}

export interface BoundaryType<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export type CommitPhase =
  | typeof MutationPhase
  | typeof LayoutPhase
  | typeof PassivePhase;

export type CommitPhases = number;

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
    scope: Scope.ChildScope<TPart, TRenderer>,
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

export interface HostAdapter<TPart, TRenderer> {
  getCommitPhases(): CommitPhases;
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
  ensureValue(value: unknown, part: TPart): void;
}

export interface Update {
  id: number;
  lanes: Lanes;
  task: UpdateTask;
  controller: PromiseWithResolvers<UpdateResult>;
}

export interface UpdateHandle {
  id: number;
  lanes: Lanes;
  finished: Promise<UpdateResult>;
}

export interface UpdateOptions
  extends Pick<SchedulerPostTaskOptions, 'delay' | 'priority'> {
  flushSync?: boolean;
  transition?: number;
  viewTransition?: boolean;
}

export type UpdateResult =
  | { status: 'done' }
  | { status: 'skipped' }
  | { status: 'aborted'; reason: unknown };

export interface UpdateScheduler {
  getPendingUpdates(): Iterable<Update>;
  nextTransition(): number;
  schedule(task: UpdateTask, options?: UpdateOptions): UpdateHandle;
}

export interface UpdateTask {
  readonly scope: Scope;
  readonly pendingLanes: Lanes;
  start(session: Session): Iterable<UpdateUnit>;
}

export interface UpdateUnit<TPart = unknown, TRenderer = unknown>
  extends UpdateTask {
  readonly part: TPart;
  readonly directive: Directive.ElementDirective;
  readonly scope: Scope<TPart, TRenderer>;
  pendingLanes: Lanes;
  needsRender(): boolean;
  render(session: Session<TPart, TRenderer>): Iterable<UpdateUnit>;
}

export type Scope<TPart = unknown, TRenderer = unknown> =
  | Scope.ChildScope<TPart, TRenderer>
  | Scope.OrphanScope
  | Scope.RootScope<TPart>;

export namespace Scope {
  export type ChildScope<TPart = unknown, TRenderer = unknown> = {
    owner: UpdateUnit<TPart, TRenderer>;
    level: number;
    boundary: Boundary<unknown> | null;
  };

  export type RootScope<TPart = unknown> = {
    owner: Root<TPart>;
    level: 0;
    boundary: Boundary<unknown> | null;
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
  commitPhases: CommitPhases;
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
  adapter: HostAdapter<TPart, TRenderer>;
  renderer: TRenderer;
  scheduler: UpdateScheduler;
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
