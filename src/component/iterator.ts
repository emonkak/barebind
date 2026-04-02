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

type Cleanup = () => void;

type Setup = () => Cleanup | void;

export interface IteratorComponentOptions<TProps> {
  arePropsEqual?: (newProps: TProps, oldProps: TProps) => boolean;
}

export type IteratorComponent<TProps, TReturn, TPart> = (
  this: IteratorComponentContext<TProps>,
  props: TProps,
) => Iterator<TReturn, TReturn, TPart>;

export class IteratorComponentHandler<TProps, TReturn, TPart>
  implements DirectiveHandler<TProps, TPart>, ErrorHandler
{
  private readonly _componentFn: IteratorComponent<TProps, TReturn, TPart>;

  private readonly _arePropsEqual: (
    newProps: TProps,
    oldProps: TProps,
  ) => boolean;

  private _context: IteratorComponentContext<TProps> | null = null;

  private _iterator: Iterator<TReturn, TReturn, TPart> | null = null;

  private _slot: Slot<TPart> | null = null;

  constructor(
    componentFn: IteratorComponent<TProps, TReturn, TPart>,
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
    part: TPart,
    scope: Scope.ChildScope<TPart>,
    session: Session<TPart>,
  ): Iterable<Slot<TPart>> {
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
    _part: TPart,
    scope: Scope<TPart>,
    session: Session<TPart>,
  ): void {
    if (this._context !== null) {
      completeContext(this._context, scope, session);
    }
  }

  discard(
    _props: TProps,
    _part: TPart,
    scope: Scope<TPart>,
    session: Session<TPart>,
  ): void {
    if (this._context !== null) {
      discardContext(this._context, scope, session);
    }
    this._iterator?.return?.();
    this._iterator = null;
    this._slot?.discard(session);
  }

  commit(_newValue: TProps, _oldValue: TProps | null, _part: TPart): void {
    this._slot?.commit();
  }

  revert(_value: TProps, _part: TPart): void {
    this._slot?.revert();
  }

  handleError(error: unknown, forwardError: (error: unknown) => void): void {
    if (this._iterator?.throw !== undefined && this._slot !== null) {
      try {
        const iteration = this._iterator.throw(error);
        if (iteration.done) {
          this._iterator = null;
        }
        const slot = this._slot;
        const context = this._context!;
        const directive = wrap(iteration.value);
        slot.update(directive, context._scope as Scope.ChildScope<TPart>);
        context._session.scheduler.schedule(slot);
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
  readonly _insertionSetups: Setup[] = [];
  /** @internal */
  readonly _layoutSetups: Setup[] = [];
  /** @internal */
  readonly _passiveSetups: Setup[] = [];
  /** @internal */
  readonly _pendingActions: Action[] = [];
  /** @internal */
  readonly _pendingCleanups: Cleanup[] = [];

  *[Symbol.iterator](): Generator<TProps> {
    while (isChildScope(this._scope)) {
      yield this._scope.owner.directive.value as TProps;
    }
  }

  postEffect(setup: Setup): void {
    this._passiveSetups.push(setup);
  }

  postInsertionEffect(setup: Setup): void {
    this._insertionSetups.push(setup);
  }

  postLayoutEffect(setup: Setup): void {
    this._layoutSetups.push(setup);
  }

  update(action: Action, options?: UpdateOptions): UpdateHandle {
    const handle = this.forceUpdate(options);
    this._pendingActions.push(action);
    return handle;
  }
}

export function createIteratorComponent<
  TProps = {},
  TReturn = unknown,
  TPart = unknown,
>(
  componentFn: IteratorComponent<TProps, TReturn, TPart>,
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
  private readonly _pendingCleanups: Cleanup[];
  private readonly _scope: Scope;

  constructor(pendingCleanups: (() => void)[], scope: Scope) {
    this._pendingCleanups = pendingCleanups;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  commit(): void {
    for (const cleaup of this._pendingCleanups.splice(0)) {
      cleaup();
    }
  }
}

class PostEffects implements Effect {
  private readonly _setups: Setup[];
  private readonly _pendingCleanups: Cleanup[];
  private readonly _scope: Scope;

  constructor(setups: Setup[], pendingCleanups: Cleanup[], scope: Scope) {
    this._setups = setups;
    this._pendingCleanups = pendingCleanups;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  commit(): void {
    for (const setup of this._setups) {
      const cleanup = setup();
      if (cleanup !== undefined) {
        this._pendingCleanups.push(cleanup);
      }
    }
  }
}

function completeContext<TProps, TPart>(
  context: IteratorComponentContext<TProps>,
  scope: Scope<TPart>,
  session: Session<TPart>,
): void {
  const insertionSetups = context._insertionSetups;
  const layoutSetups = context._layoutSetups;
  const passiveSetups = context._passiveSetups;
  const pendingCleanups = context._pendingCleanups;
  if (insertionSetups.length > 0) {
    session.mutationEffects.push(
      new PostEffects(insertionSetups.splice(0), pendingCleanups, scope),
    );
  }
  if (layoutSetups.length > 0) {
    session.layoutEffects.push(
      new PostEffects(layoutSetups.splice(0), pendingCleanups, scope),
    );
  }
  if (passiveSetups.length > 0) {
    session.passiveEffects.push(
      new PostEffects(passiveSetups.splice(0), pendingCleanups, scope),
    );
  }
}

function discardContext<TProps, TPart>(
  context: IteratorComponentContext<TProps>,
  scope: Scope<TPart>,
  session: Session<TPart>,
): void {
  const pendingCleanups = context._pendingCleanups;
  if (pendingCleanups.length > 0) {
    session.mutationEffects.push(new FlushCleanups(pendingCleanups, scope));
  }
  context._scope = OrphanScope;
  context._session = session;
}

function flushContext<TProps, TPart>(
  context: IteratorComponentContext<TProps>,
  scope: Scope<TPart>,
  session: Session<TPart>,
): void {
  for (const action of context._pendingActions.splice(0)) {
    action();
  }
  context._scope = scope;
  context._session = session;
}
