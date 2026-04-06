import {
  ErrorBoundary,
  type ErrorHandler,
  type Scope,
  type Session,
  SharedContextBoundary,
  type UpdateHandle,
  type UpdateOptions,
} from '../core.js';
import { AbortError } from '../error.js';
import { getRootScope, handleError, isChildScope } from '../scope.js';

export type Usable<TContext extends ComponentContext, TReturn> =
  | Usable.UsableClass<TContext, TReturn>
  | Usable.UsableObject<TContext, TReturn>
  | Usable.UsableFunction<TContext, TReturn>;

export namespace Usable {
  /**
   * Represents a class with static [$hook] method. never[] and NoInfer<T> ensure
   * T is inferred solely from the constructor.
   */
  export interface UsableClass<
    TContext extends ComponentContext,
    TReturn = void,
  > {
    new (...args: never[]): TReturn;
    onUse(context: TContext): NoInfer<TReturn>;
  }

  export type UsableFunction<
    TContext extends ComponentContext,
    TReturn = void,
  > = (context: TContext) => TReturn;

  export interface UsableObject<
    TContext extends ComponentContext,
    TReturn = void,
  > {
    onUse(context: TContext): TReturn;
  }
}

export class ComponentContext {
  /** @internal */
  _scope: Scope;
  /** @internal */
  _session: Session;

  constructor(scope: Scope, session: Session) {
    this._scope = scope;
    this._session = session;
  }

  addErrorHandler(handler: ErrorHandler): void {
    this._scope.boundary = {
      type: ErrorBoundary,
      next: this._scope.boundary,
      handler,
    };
  }

  forceUpdate(options?: UpdateOptions): UpdateHandle {
    if (!isChildScope(this._scope)) {
      return {
        id: -1,
        lanes: 0,
        finished: Promise.resolve({
          status: 'skipped',
        }),
      };
    }
    if (!Object.isFrozen(this._scope)) {
      for (const update of this._session.scheduler.updateQueue) {
        if (update.id === this._session.id) {
          this._scope.owner.pendingLanes |= update.lanes;
          return {
            id: update.id,
            lanes: update.lanes,
            finished: update.controller.promise,
          };
        }
      }
    }
    const handle = this._session.scheduler.schedule(this._scope.owner, options);
    this._scope.owner.pendingLanes |= handle.lanes;
    return handle;
  }

  forwardError(error: unknown): void {
    try {
      handleError(this._scope, error);
    } catch (error) {
      throw new AbortError(
        this._scope,
        'No error boundary handled the error.',
        { cause: error },
      );
    }
  }

  getSharedContext<T>(key: unknown): T | undefined {
    let scope: Scope | null = this._scope;
    while (true) {
      for (
        let boundary = scope.boundary;
        boundary !== null;
        boundary = boundary.next
      ) {
        if (
          boundary.type === SharedContextBoundary &&
          Object.is(boundary.key, key)
        ) {
          return boundary.value as T;
        }
      }
      if (!isChildScope(scope)) {
        break;
      }
      scope = scope.owner.scope;
    }
    return undefined;
  }

  nextId(): string {
    const root = getRootScope(this._scope);
    return root !== null ? root.owner.idPrefix + '-' + root.owner.idSeq++ : '';
  }

  setSharedContext<T>(key: unknown, value: T): void {
    this._scope.boundary = {
      type: SharedContextBoundary,
      next: this._scope.boundary,
      key,
      value,
    };
  }

  startTransition<T>(action: (transition: number) => T): T {
    const transition = this._session.scheduler.nextTransition();
    const result = action(transition);
    if (result instanceof Promise) {
      result.catch((error) => {
        this.forwardError(error);
      });
    }
    return result;
  }

  use<TReturn>(usable: Usable.UsableClass<this, TReturn>): TReturn;
  use<TReturn>(usable: Usable.UsableObject<this, TReturn>): TReturn;
  use<TReturn>(usable: Usable.UsableFunction<this, TReturn>): TReturn;
  use<TReturn>(usable: Usable<this, TReturn>): TReturn {
    return 'onUse' in usable ? usable.onUse(this) : usable(this);
  }
}
