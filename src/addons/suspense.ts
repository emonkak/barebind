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
  const pendingSuspends = $.useMemo<Suspend<unknown>[]>(() => [], [children]);

  const areSuspendsSettled = () =>
    pendingSuspends.every(
      ({ status }) => status === 'fulfilled' || status === 'rejected',
    );

  $.catchError((error, handle) => {
    if (error instanceof Suspend) {
      const callback = () => {
        if (areSuspendsSettled()) {
          $.forceUpdate();
        }
      };

      error.then(callback, callback);

      if (pendingSuspends.push(error) === 1) {
        $.forceUpdate();
      }
    } else {
      handle(error);
    }
  });

  $.useEffect(() => {
    return () => {
      for (const suspend of pendingSuspends) {
        suspend.abort();
      }
    };
  }, [pendingSuspends]);

  const shouldRenderChildren = areSuspendsSettled();

  return Fragment([
    Flexible(shouldRenderChildren ? children : null),
    Flexible(shouldRenderChildren ? null : fallback),
  ]);
});

export const Resource = function Resource<T>(
  fetch: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[] = [],
): HookFunction<Suspend<T>> {
  return (context) =>
    context.useMemo(() => {
      const controller = new AbortController();
      const promise = fetch(controller.signal);
      return new Suspend(promise, controller);
    }, dependencies);
};

export type SuspendStatus = 'pending' | 'fulfilled' | 'rejected' | 'aborted';

export class Suspend<T> implements PromiseLike<T> {
  private readonly _promise: Promise<T>;

  private readonly _controller: AbortController;

  private _status: SuspendStatus = 'pending';

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

  get status(): SuspendStatus {
    return this._status;
  }

  get value(): T | undefined {
    return this._value;
  }

  get reason(): unknown {
    return this._reason;
  }

  abort(): void {
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
        promise = Promise.race([
          this._promise,
          waitForSignal<T>(this._controller.signal),
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

function waitForSignal<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(signal.reason);
    });
  });
}
