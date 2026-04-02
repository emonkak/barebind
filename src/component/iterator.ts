import {
  type Component,
  Directive,
  type DirectiveHandler,
  type Scope,
  type Session,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  wrap,
} from '../core.js';
import { isChildScope, OrphanScope } from '../scope.js';
import { Slot } from '../slot.js';

export interface IteratorComponentOptions<TProps> {
  arePropsEqual?: (newProps: TProps, oldProps: TProps) => boolean;
}

export type IteratorComponent<TProps, TReturn, TPart> = (
  this: IteratorComponentContext<TProps>,
  props: TProps,
) => Iterator<TReturn, TReturn, TPart>;

interface Action {
  callback: () => void;
}

export class IteratorComponentHandler<TProps, TReturn, TPart, TRenderer>
  implements DirectiveHandler<TProps, TPart>
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
    scope: Scope.ChildScope<TPart, TRenderer>,
    session: Session<TPart, TRenderer>,
  ): Iterable<Slot<TPart, TRenderer>> {
    if (this._context !== null) {
      resetContext(this._context, scope, session);
      applyPendingActions(this._context);
    } else {
      this._context = new IteratorComponentContext<TProps>(scope, session);
    }

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
    _scope: Scope<TPart, TRenderer>,
    _session: Session<TPart, TRenderer>,
  ): void {}

  discard(
    _props: TProps,
    _part: TPart,
    _scope: Scope<TPart, TRenderer>,
    session: Session<TPart, TRenderer>,
  ): void {
    if (this._context !== null) {
      resetContext(this._context, OrphanScope, session);
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
}

export class IteratorComponentContext<TProps> {
  /** @internal */
  _scope: Scope;
  /** @internal */
  _session: Session;
  /** @internal */
  readonly _actionQueue: Action[] = [];

  constructor(scope: Scope.ChildScope, session: Session) {
    this._scope = scope;
    this._session = session;
  }

  *[Symbol.iterator](): Generator<TProps> {
    while (isChildScope(this._scope)) {
      yield this._scope.owner.directive.value as TProps;
    }
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (!isChildScope(this._scope)) {
      const skipped: Promise<UpdateResult> = Promise.resolve({
        status: 'skipped',
      });
      return {
        id: -1,
        lanes: 0,
        scheduled: skipped,
        finished: skipped,
      };
    }
    if (!Object.isFrozen(this._scope)) {
      for (const update of this._session.scheduler.updateQueue) {
        if (update.id === this._session.id) {
          this._scope.owner.pendingLanes |= update.lanes;
          return {
            id: update.id,
            lanes: update.lanes,
            scheduled: Promise.resolve({ status: 'done' }),
            finished: update.controller.promise,
          };
        }
      }
    }
    const handle = this._session.scheduler.schedule(this._scope.owner, options);
    this._scope.owner.pendingLanes |= handle.lanes;
    return handle;
  }

  update(callback: () => void, options?: UpdateOptions): UpdateHandle {
    const handle = this.forceUpdate(options);
    this._actionQueue.push({
      callback,
    });
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
  ): DirectiveHandler<TProps> =>
    new IteratorComponentHandler(componentFn, arePropsEqual);

  DEBUG: {
    Object.defineProperty(Component, 'name', {
      value: componentFn.name,
    });
  }

  return Component;
}

function applyPendingActions<TProps>(
  context: IteratorComponentContext<TProps>,
): void {
  for (const { callback } of context._actionQueue.splice(0)) {
    callback();
  }
}

function resetContext<TProps>(
  context: IteratorComponentContext<TProps>,
  scope: Scope,
  session: Session,
): void {
  context._scope = scope;
  context._session = session;
}
