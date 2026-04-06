import {
  type Component,
  Directive,
  type DirectiveHandler,
  type Effect,
  type ErrorHandler,
  type Scope,
  type Session,
  type UpdateHandle,
  type UpdateOptions,
  wrap,
} from '../core.js';
import { isChildScope, OrphanScope } from '../scope.js';
import { Slot } from '../slot.js';
import { ComponentContext } from './component.js';

type Action = () => void;

type EffectCleanup = () => void;

type EffectSetup = () => EffectCleanup | void;

export interface IteratorComponentOptions<TProps> {
  arePropsEqual?: (newProps: TProps, oldProps: TProps) => boolean;
}

export type IteratorComponent<TProps, TReturn> = (
  this: IteratorComponentContext<TProps>,
  props: TProps,
) => Iterator<TReturn, TReturn>;

export class IteratorComponentHandler<TProps, TReturn>
  implements DirectiveHandler<TProps>, ErrorHandler
{
  private readonly _componentFn: IteratorComponent<TProps, TReturn>;

  private readonly _arePropsEqual: (
    newProps: TProps,
    oldProps: TProps,
  ) => boolean;

  private _context: IteratorComponentContext<TProps> | null = null;

  private _iterator: Iterator<TReturn, TReturn> | null = null;

  private _slot: Slot | null = null;

  constructor(
    componentFn: IteratorComponent<TProps, TReturn>,
    arePropsEqual: (newProps: TProps, oldProps: TProps) => boolean,
  ) {
    this._componentFn = componentFn;
    this._arePropsEqual = arePropsEqual;
  }

  shouldUpdate(newProps: TProps, oldProps: TProps): boolean {
    const arePropsEqual = this._arePropsEqual;
    return !arePropsEqual(newProps, oldProps);
  }

  render(
    props: TProps,
    part: unknown,
    scope: Scope.ChildScope,
    session: Session,
  ): Iterable<Slot> {
    if (this._context !== null) {
      flushContext(this._context, scope, session);
    } else {
      this._context = new IteratorComponentContext<TProps>(scope, session);
    }

    this._context.addErrorHandler(this);

    this._iterator ??= this._componentFn.call(this._context, props);
    const iteration = this._iterator.next(part);

    if (iteration.done) {
      this._iterator = null;
    }

    const directive = wrap(iteration.value);
    this._slot =
      this._slot?.update(directive, scope) ?? new Slot(part, directive, scope);

    return [this._slot];
  }

  complete(
    _props: TProps,
    _part: unknown,
    scope: Scope.ChildScope,
    session: Session,
  ): void {
    if (this._context !== null) {
      completeContext(this._context, scope, session);
    }
  }

  discard(
    _props: TProps,
    _part: unknown,
    scope: Scope,
    session: Session,
  ): void {
    if (this._context !== null) {
      discardContext(this._context, scope, session);
    }
    this._iterator?.return?.();
    this._iterator = null;
    this._slot?.discard(session);
  }

  mount(_newValue: TProps, _oldValue: TProps | null, _part: unknown): void {
    this._slot?.commit();
  }

  unmount(_value: TProps, _part: unknown): void {
    this._slot?.revert();
  }

  handleError(error: unknown, forwardError: (error: unknown) => void): void {
    if (
      this._iterator?.throw !== undefined &&
      this._slot !== null &&
      this._context !== null
    ) {
      try {
        const iteration = this._iterator.throw(error);
        if (iteration.done) {
          this._iterator = null;
        }
        const slot = this._slot;
        const context = this._context;
        const directive = wrap(iteration.value);
        slot.update(directive, context._scope);
        const handle = context._session.scheduler.schedule(slot);
        slot.pendingLanes |= handle.lanes;
      } catch (error) {
        this._iterator = null;
        forwardError(error);
      }
    } else {
      forwardError(error);
    }
  }
}

export class IteratorComponentContext<TProps> extends ComponentContext {
  /** @internal */
  readonly _insertionEffects: EffectSetup[] = [];
  /** @internal */
  readonly _layoutEffects: EffectSetup[] = [];
  /** @internal */
  readonly _passiveEffects: EffectSetup[] = [];
  /** @internal */
  readonly _pendingActions: Action[] = [];
  /** @internal */
  readonly _pendingCleanups: EffectCleanup[] = [];

  *[Symbol.iterator](): Generator<TProps> {
    while (isChildScope(this._scope)) {
      yield this._scope.owner.directive.value as TProps;
    }
  }

  postEffect(setup: EffectSetup): void {
    this._passiveEffects.push(setup);
  }

  postInsertionEffect(setup: EffectSetup): void {
    this._insertionEffects.push(setup);
  }

  postLayoutEffect(setup: EffectSetup): void {
    this._layoutEffects.push(setup);
  }

  update(action: Action, options?: UpdateOptions): UpdateHandle {
    const handle = this.forceUpdate(options);
    this._pendingActions.push(action);
    return handle;
  }
}

export function createIteratorComponent<TProps = {}, TReturn = unknown>(
  componentFn: IteratorComponent<TProps, TReturn>,
  { arePropsEqual = Object.is }: IteratorComponentOptions<TProps> = {},
): Component<TProps> {
  function Component(props: TProps): Directive.ComponentDirective<TProps> {
    return new Directive(Component, props);
  }

  Component.resolveComponent = (
    _directive: Directive.ComponentDirective<TProps>,
    _part: unknown,
  ): DirectiveHandler<TProps> =>
    new IteratorComponentHandler(componentFn, arePropsEqual);

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
    });
  }

  return Component;
}

class FlushCleanups implements Effect {
  private readonly _cleanups: EffectCleanup[];
  private readonly _scope: Scope;

  constructor(cleanups: (() => void)[], scope: Scope) {
    this._cleanups = cleanups;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  commit(): void {
    for (const cleaup of this._cleanups.splice(0)) {
      cleaup();
    }
  }
}

class SetupEffects implements Effect {
  private readonly _setups: EffectSetup[];
  private readonly _cleanups: EffectCleanup[];
  private readonly _scope: Scope;

  constructor(setups: EffectSetup[], cleanups: EffectCleanup[], scope: Scope) {
    this._setups = setups;
    this._cleanups = cleanups;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  commit(): void {
    for (const setup of this._setups) {
      const cleanup = setup();
      if (cleanup !== undefined) {
        this._cleanups.push(cleanup);
      }
    }
  }
}

function completeContext<TProps>(
  context: IteratorComponentContext<TProps>,
  scope: Scope,
  session: Session,
): void {
  const insertionEffects = context._insertionEffects;
  const layoutEffects = context._layoutEffects;
  const passiveEffects = context._passiveEffects;
  const pendingCleanups = context._pendingCleanups;
  if (insertionEffects.length > 0) {
    session.mutationEffects.push(
      new SetupEffects(insertionEffects.splice(0), pendingCleanups, scope),
    );
  }
  if (layoutEffects.length > 0) {
    session.layoutEffects.push(
      new SetupEffects(layoutEffects.splice(0), pendingCleanups, scope),
    );
  }
  if (passiveEffects.length > 0) {
    session.passiveEffects.push(
      new SetupEffects(passiveEffects.splice(0), pendingCleanups, scope),
    );
  }
}

function discardContext<TProps>(
  context: IteratorComponentContext<TProps>,
  scope: Scope,
  session: Session,
): void {
  const pendingCleanups = context._pendingCleanups;
  if (pendingCleanups.length > 0) {
    session.mutationEffects.push(new FlushCleanups(pendingCleanups, scope));
  }
  context._scope = OrphanScope;
  context._session = session;
}

function flushContext<TProps>(
  context: IteratorComponentContext<TProps>,
  scope: Scope,
  session: Session,
): void {
  for (const action of context._pendingActions.splice(0)) {
    action();
  }
  context._scope = scope;
  context._session = session;
}
