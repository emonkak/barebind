/// <reference path="../typings/scheduler.d.ts" />

export const Fragment = Symbol('Fragment');
export const Primitive = Symbol('Primitive');

export const toDirective: unique symbol = Symbol('Directive.toDirective');

export interface Boundary<T extends object> {
  instance: T;
  next: Boundary<object> | null;
}

export interface BoundaryType<TInstance, TDefault> {
  new (...args: never[]): TInstance;
  getDefault?(): TDefault;
}

export interface Component<TProps> extends Renderable<TProps> {
  (props: TProps): Directive.ComponentDirective<TProps>;
}

export interface Directable {
  [toDirective](): Directive.ElementDirective;
}

export namespace Directive {
  export type ElementDirective =
    | ComponentDirective<unknown>
    | FragmentDirective<unknown>
    | PrimitiveDirective<unknown>
    | TemplateDirective;

  export type ComponentDirective<TProps> = Directive<Component<TProps>, TProps>;

  export type FragmentDirective<TSource> = Directive<
    typeof Fragment,
    Iterable<TSource>
  >;

  export type PrimitiveDirective<TValue> = Directive<typeof Primitive, TValue>;

  export type TemplateDirective = Directive<readonly string[], Template>;
}

export interface HostAdapter<TPart, TRenderer> {
  getDefaultLanes(): Lanes;
  getIdentifier(): string;
  getTaskPriority(): TaskPriority;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: SchedulerPostTaskOptions,
  ): Promise<T>;
  requestRenderer(scope: Scope): TRenderer;
  resolveFragment(
    directive: Directive.FragmentDirective<unknown>,
    part: TPart,
  ): Renderable<Iterable<unknown>, TPart, TRenderer>;
  resolvePrimitive(
    directive: Directive.PrimitiveDirective<unknown>,
    part: TPart,
  ): Primitive<unknown, TPart, TRenderer>;
  resolveTemplate(
    directive: Directive.TemplateDirective,
    part: TPart,
  ): Renderable<Template, TPart, TRenderer>;
  startViewTransition(callback: () => PromiseLike<void> | void): Promise<void>;
  yieldToMain(): Promise<void>;
}

export type Lane = number;

export type Lanes = number;

export interface Mountable<TValue, TPart = unknown, TRenderer = unknown> {
  readonly children: Iterable<UpdateUnit>;
  patch(
    value: TValue,
    part: TPart,
    scope: Scope.ChildScope<TPart>,
    session: Session<TPart, TRenderer>,
  ): void;
  mount(part: TPart): void;
  afterMount(part: TPart): void;
  beforeUnmount(part: TPart): void;
  unmount(part: TPart): void;
}

export interface Renderable<TValue, TPart = unknown, TRenderer = unknown> {
  shouldUpdate(newValue: TValue, oldValue: TValue): boolean;
  render(
    value: TValue,
    part: TPart,
    scope: Scope.ChildScope<TPart>,
    session: Session<TPart, TRenderer>,
  ): Mountable<TValue, TPart, TRenderer>;
}

export interface Root<TPart> {
  part: TPart;
}

export interface Primitive<TValue, TPart = unknown, TRenderer = unknown>
  extends Renderable<TValue, TPart, TRenderer> {
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
  inherit?: boolean;
  resume?: boolean;
  transition?: number;
  viewTransition?: boolean;
}

export type UpdateResult =
  | { status: 'done' }
  | { status: 'skipped' }
  | { status: 'intrupted'; reason: unknown };

export interface UpdateScheduler {
  readonly currentUpdate: Update | undefined;
  nextIdentifier(): string;
  nextTransition(): number;
  schedule(task: UpdateTask, options?: UpdateOptions): UpdateHandle;
}

export interface UpdateTask<TPart = unknown> {
  readonly scope: Scope;
  readonly pendingLanes: Lanes;
  render(session: Session<TPart>): Iterable<UpdateUnit>;
  complete(): void;
}

export interface UpdateUnit<TPart = unknown> extends UpdateTask<TPart> {
  readonly part: TPart;
  readonly directive: Directive.ElementDirective;
  pendingLanes: Lanes;
  needsRender(): boolean;
}

export type Scope<TPart = unknown> =
  | Scope.ChildScope<TPart>
  | Scope.OrphanScope
  | Scope.RootScope<TPart>;

export namespace Scope {
  export type ChildScope<TPart = unknown> = {
    owner: UpdateUnit<TPart>;
    level: number;
    boundary: Boundary<object> | null;
  };

  export type RootScope<TPart = unknown> = {
    owner: Root<TPart>;
    level: 0;
    boundary: Boundary<object> | null;
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
      ? new Directive(Fragment, value)
      : new Directive(Primitive, value);
}

function isDirectable(value: any): value is Directable {
  return typeof value?.[toDirective] === 'function';
}

function isIterable(value: any): value is Iterable<unknown> {
  return typeof value?.[Symbol.iterator] === 'function';
}
