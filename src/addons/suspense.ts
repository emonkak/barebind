import { createComponent } from '../component.js';
import type { HookFunction, RenderContext } from '../internal.js';
import { Flexible } from '../layout/flexible.js';
import { Fragment } from '../template.js';

export interface SuspenseProps {
  children: unknown;
  fallback: unknown;
}

export const Suspense = createComponent(function Suspense(
  { children, fallback }: SuspenseProps,
  $: RenderContext,
): unknown {
  const pendingHandles = $.useMemo<RawResourceHandle<unknown>[]>(
    () => [],
    [children],
  );

  const areHandlesSettled = () =>
    pendingHandles.every(
      ({ status }) => status === 'fulfilled' || status === 'rejected',
    );

  $.catchError((error, handle) => {
    if (error instanceof RawResourceHandle) {
      const callback = () => {
        if (areHandlesSettled()) {
          $.forceUpdate();
        }
      };

      error.then(callback, callback);

      if (pendingHandles.push(error) === 1) {
        $.forceUpdate();
      }
    } else {
      handle(error);
    }
  });

  $.useEffect(() => {
    return () => {
      for (const handle of pendingHandles) {
        handle.dispose();
      }
    };
  }, [pendingHandles]);

  const shouldRenderChildren = areHandlesSettled();

  return Fragment([
    Flexible(shouldRenderChildren ? children : null),
    Flexible(shouldRenderChildren ? null : fallback),
  ]);
});

export const Resource = function Resource<T>(
  fetch: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[] = [],
): HookFunction<ResourceHandle<T>> {
  return (context) =>
    context.useMemo(() => {
      const controller = new AbortController();
      const promise = fetch(controller.signal);
      return new RawResourceHandle(promise, controller) as ResourceHandle<T>;
    }, dependencies);
};

export type ResourceHandle<T> = RawResourceHandle<T> &
  ResourceHandleConstraint<T>;

type ResourceHandleConstraint<T> =
  | { status: 'pending'; value: never; reason: never }
  | { status: 'fulfilled'; value: T; reason: never }
  | { status: 'rejected' | 'aborted'; value: never; reason: unknown };

type ResuorceStatus = 'pending' | 'fulfilled' | 'rejected' | 'aborted';

/**
 * @internal
 */
export class RawResourceHandle<T> implements PromiseLike<T> {
  private readonly _promise: Promise<T>;

  private readonly _controller: AbortController;

  private _status: ResuorceStatus = 'pending';

  private _value: T | undefined;

  private _reason: unknown;

  constructor(promise: Promise<T>, controller: AbortController) {
    promise.then(
      (value) => {
        this._status = 'fulfilled';
        this._value = value;
      },
      (reason) => {
        this._status = 'rejected';
        this._reason = reason;
      },
    );

    controller.signal.addEventListener('abort', () => {
      this._status = 'aborted';
      this._reason = controller.signal.reason;
    });

    this._promise = promise;
    this._controller = controller;
  }

  get status(): ResuorceStatus {
    return this._status;
  }

  get value(): T | undefined {
    return this._value;
  }

  get reason(): unknown {
    return this._reason;
  }

  dispose(): void {
    if (this._status === 'pending') {
      this._controller.abort();
    }
  }

  then<TFulfilled = T, TRejected = never>(
    onFulfilled?:
      | ((value: T) => TFulfilled | PromiseLike<TFulfilled>)
      | undefined
      | null,
    onRejected?:
      | ((reason: any) => TRejected | PromiseLike<TRejected>)
      | undefined
      | null,
  ): Promise<TFulfilled | TRejected> {
    let promise: Promise<T>;
    switch (this._status) {
      case 'pending': {
        const { signal } = this._controller;
        promise = Promise.race([
          this._promise,
          new Promise<T>((_, reject) => {
            signal.addEventListener(
              'abort',
              () => {
                reject(signal.reason);
              },
              {
                once: true,
              },
            );
          }),
        ]);
        break;
      }
      case 'fulfilled':
        promise = Promise.resolve(this._value!);
        break;
      case 'rejected':
      case 'aborted':
        promise = Promise.reject(this._reason);
        break;
    }
    return promise.then(onFulfilled, onRejected);
  }

  unwrap(): T {
    switch (this._status) {
      case 'pending':
        throw this;
      case 'fulfilled':
        return this._value!;
      case 'rejected':
      case 'aborted':
        throw this._reason;
    }
  }
}
