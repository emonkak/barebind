import { LinkedList } from './collections/linked-list.js';
import {
  type Backend,
  type CommitPhase,
  type Component,
  type ComponentState,
  type Coroutine,
  createUpdateSession,
  type Directive,
  EffectQueue,
  getLanesFromOptions,
  Lane,
  type Lanes,
  type Part,
  type Primitive,
  type RenderFrame,
  type SessionContext,
  type SessionEvent,
  type SessionObserver,
  type Slot,
  type Template,
  type TemplateMode,
  type UnwrapBindable,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateResult,
  type UpdateSession,
  type UpdateTask,
} from './core.js';
import { toDirective } from './directive.js';
import { handleError, InterruptError } from './error.js';
import { RenderSession } from './render-session.js';

export interface RuntimeOptions {
  uniqueIdentifier?: string;
  maxCoroutinesPerYield?: number;
}

export class Runtime implements SessionContext {
  private readonly _backend: Backend;

  private readonly _cachedTemplates: WeakMap<
    readonly string[],
    Template<readonly unknown[]>
  > = new WeakMap();

  private readonly _observers: LinkedList<SessionObserver> = new LinkedList();

  private _identifierCount: number = 0;

  private readonly _maxCoroutinesPerYield: number;

  private readonly _scheduledUpdates: LinkedList<UpdateTask> = new LinkedList();

  private readonly _uniqueIdentifier: string;

  private _updateCount: number = 0;

  constructor(
    backend: Backend,
    {
      maxCoroutinesPerYield = 100,
      uniqueIdentifier = generateUniqueIdentifier(8),
    }: RuntimeOptions = {},
  ) {
    this._backend = backend;
    this._maxCoroutinesPerYield = maxCoroutinesPerYield;
    this._uniqueIdentifier = uniqueIdentifier;
  }

  addObserver(observer: SessionObserver): () => void {
    const observers = this._observers;
    const node = observers.pushBack(observer);
    return () => {
      observers.remove(node);
    };
  }

  async flushUpdates(): Promise<void> {
    for (
      let scheduledUpdate: UpdateTask | undefined;
      (scheduledUpdate = this._scheduledUpdates.front()?.value) !== undefined;
      this._scheduledUpdates.popFront()
    ) {
      const { controller, coroutine, id, lanes, transition } = scheduledUpdate;

      if ((coroutine.pendingLanes & lanes) === Lane.NoLane) {
        controller.resolve({ done: true, canceled: true });
        continue;
      }

      const frame = createRenderFrame(id, lanes, coroutine);
      const { scope } = coroutine;
      const session = createUpdateSession(frame, scope, scope, this);

      notifyObservers(this._observers, {
        type: 'update-start',
        id,
        lanes,
      });

      try {
        if (scheduledUpdate.lanes & Lane.SyncLane) {
          this._runRenderSync(session);
          this._runCommitSync(session);
        } else {
          await this._runRenderAsync(session);

          if (transition !== null) {
            transition.then(
              () => this._runCommitAsync(session, lanes),
              () => {},
            );
          } else {
            await this._runCommitAsync(session, lanes);
          }
        }

        notifyObservers(this._observers, {
          type: 'update-success',
          id,
          lanes,
        });

        controller.resolve({ done: true, canceled: false });
      } catch (error) {
        resetRenderFrame(frame);

        notifyObservers(this._observers, {
          type: 'update-failure',
          id,
          lanes,
          error,
        });

        if (error instanceof InterruptError) {
          controller.resolve({ done: false, canceled: true });
        } else {
          controller.reject(error);
        }
      }
    }
  }

  getScheduledUpdates(): UpdateTask[] {
    return Array.from(this._scheduledUpdates);
  }

  nextIdentifier(): string {
    // The identifier is also valid as a view transition name.
    return this._uniqueIdentifier + '-' + this._identifierCount++;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    state: ComponentState,
    coroutine: Coroutine,
    frame: RenderFrame,
  ): TResult {
    const { id } = frame;

    const context = new RenderSession(state, coroutine, frame, this);

    notifyObservers(this._observers, {
      type: 'component-render-start',
      id,
      component,
      props,
      context,
    });

    const result = component.render(props, context);

    context.finalize();

    notifyObservers(this._observers, {
      type: 'component-render-end',
      id,
      component,
      props,
      context,
    });

    return result;
  }

  resolveDirective<T>(
    source: T,
    part: Part,
  ): Required<Directive<UnwrapBindable<T>>> {
    let { type, value, layout, defaultLayout } = toDirective(source);

    if (type === undefined) {
      type = this._backend.resolvePrimitive(source, part) as Primitive<
        UnwrapBindable<T>
      >;
      (type as Primitive<UnwrapBindable<T>>).ensureValue?.(source, part);
    }

    defaultLayout ??= this._backend.resolveLayout(source, part);
    layout ??= defaultLayout;

    return { type, value, layout, defaultLayout };
  }

  resolveSlot<T>(source: T, part: Part): Slot<T> {
    const { type, value, layout, defaultLayout } = this.resolveDirective(
      source,
      part,
    );
    const binding = type.resolveBinding(value, part, this);
    return layout.placeBinding(binding, defaultLayout);
  }

  resolveTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    let template = this._cachedTemplates.get(strings);

    if (template === undefined) {
      template = this._backend.parseTemplate(
        strings,
        values,
        this._uniqueIdentifier,
        mode,
      );
      this._cachedTemplates.set(strings, template);
    }

    return template;
  }

  scheduleUpdate(
    coroutine: Coroutine,
    options: UpdateOptions = {},
  ): UpdateHandle {
    options = {
      flushSync: false,
      immediate: false,
      priority: this._backend.getUpdatePriority(),
      triggerFlush: true,
      viewTransition: false,
      ...options,
    } satisfies Omit<
      Required<UpdateOptions>,
      'delay' | 'signal' | 'transition'
    >;

    const id = this._updateCount++;
    const lanes =
      this._backend.getDefaultLanes() | getLanesFromOptions(options);
    const controller = Promise.withResolvers<UpdateResult>();
    let scheduled: Promise<UpdateResult>;

    const callback = () => {
      const shouldTriggerFlush =
        options.triggerFlush && this._scheduledUpdates.isEmpty();

      this._scheduledUpdates.pushBack({
        id,
        lanes,
        controller,
        coroutine,
        transition: options.transition ?? null,
      });

      if (shouldTriggerFlush) {
        scheduled.then(() => {
          this.flushUpdates();
        });
      }

      return { done: true, canceled: false };
    };

    if (options.immediate) {
      const { promise, resolve } = Promise.withResolvers<UpdateResult>();
      scheduled = promise;
      resolve(callback());
    } else {
      scheduled = this._backend.requestCallback(callback, options).catch(() => {
        // callback() is guaranteed not to throw anything; rejection here only
        // indicates AbortSignal cancellation.
        const result = { done: false, canceled: true };
        controller.resolve(result);
        return result;
      });
    }

    return {
      id,
      lanes,
      scheduled,
      finished: controller.promise,
    };
  }

  private _flushEffects(
    id: number,
    effects: EffectQueue,
    phase: CommitPhase,
  ): void {
    notifyObservers(this._observers, {
      type: 'effect-commit-start',
      id,
      effects,
      phase,
    });

    this._backend.flushEffects(effects, phase);

    notifyObservers(this._observers, {
      type: 'effect-commit-end',
      id,
      effects,
      phase,
    });
  }

  private async _runCommitAsync(
    session: UpdateSession,
    lanes: Lanes,
  ): Promise<void> {
    const { frame } = session;
    const { id, layoutEffects, mutationEffects, passiveEffects } = frame;

    notifyObservers(this._observers, {
      type: 'commit-start',
      id,
      mutationEffects,
      layoutEffects,
      passiveEffects,
    });

    try {
      if (mutationEffects.size > 0 || layoutEffects.size > 0) {
        const callback = () => {
          if (mutationEffects.size > 0) {
            this._flushEffects(id, mutationEffects, 'mutation');
          }

          if (layoutEffects.size > 0) {
            this._flushEffects(id, layoutEffects, 'layout');
          }
        };

        if (lanes & Lane.ViewTransitionLane) {
          await this._backend.startViewTransition(callback);
        } else {
          await this._backend.requestCallback(callback, {
            priority: 'user-blocking',
          });
        }
      }

      if (passiveEffects.size > 0) {
        this._backend
          .requestCallback(
            () => {
              this._flushEffects(id, passiveEffects, 'passive');
            },
            { priority: 'background' },
          )
          .finally(() => {
            notifyObservers(this._observers, {
              type: 'commit-end',
              id,
              mutationEffects,
              layoutEffects,
              passiveEffects,
            });
          });
      }
    } finally {
      // Commit Phase ends when effects indicate failure to flush
      // or when no passive effects were scheduled.
      if (
        mutationEffects.size > 0 ||
        layoutEffects.size > 0 ||
        passiveEffects.size === 0
      ) {
        notifyObservers(this._observers, {
          type: 'commit-end',
          id,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        });
      }
    }
  }

  private _runCommitSync(session: UpdateSession): void {
    const { frame } = session;
    const { id, layoutEffects, mutationEffects, passiveEffects } = frame;

    notifyObservers(this._observers, {
      type: 'commit-start',
      id,
      mutationEffects,
      layoutEffects,
      passiveEffects,
    });

    try {
      if (mutationEffects.size > 0) {
        this._flushEffects(id, mutationEffects, 'mutation');
      }

      if (layoutEffects.size > 0) {
        this._flushEffects(id, layoutEffects, 'layout');
      }

      if (passiveEffects.size > 0) {
        this._flushEffects(id, passiveEffects, 'passive');
      }
    } finally {
      notifyObservers(this._observers, {
        type: 'commit-end',
        id,
        mutationEffects,
        layoutEffects,
        passiveEffects,
      });
    }
  }

  private async _runRenderAsync(session: UpdateSession): Promise<void> {
    const { frame } = session;
    const { id, pendingCoroutines } = frame;

    notifyObservers(this._observers, {
      type: 'render-start',
      id,
    });

    try {
      while (true) {
        for (const coroutine of pendingCoroutines.splice(
          0,
          this._maxCoroutinesPerYield,
        )) {
          try {
            coroutine.resume(session);
          } catch (error) {
            processError(id, error, coroutine, this._observers);
          }
        }

        if (pendingCoroutines.length === 0) {
          break;
        }

        await this._backend.yieldToMain();
      }
    } finally {
      frame.lanes = Lane.NoLane;

      notifyObservers(this._observers, {
        type: 'render-end',
        id,
      });
    }
  }

  private _runRenderSync(session: UpdateSession): void {
    const { frame } = session;
    const { id, pendingCoroutines } = frame;

    notifyObservers(this._observers, {
      type: 'render-start',
      id,
    });

    try {
      do {
        for (const coroutine of pendingCoroutines.splice(0)) {
          try {
            coroutine.resume(session);
          } catch (error) {
            processError(id, error, coroutine, this._observers);
          }
        }
      } while (pendingCoroutines.length > 0);
    } finally {
      frame.lanes = Lane.NoLane;

      notifyObservers(this._observers, {
        type: 'render-end',
        id,
      });
    }
  }
}

function createRenderFrame(
  id: number,
  lanes: Lanes,
  coroutine: Coroutine,
): RenderFrame {
  return {
    id,
    lanes,
    pendingCoroutines: [coroutine],
    mutationEffects: new EffectQueue(),
    layoutEffects: new EffectQueue(),
    passiveEffects: new EffectQueue(),
  };
}

function generateUniqueIdentifier(length: number): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(length)),
    (byte, i) =>
      i === 0
        ? String.fromCharCode(0x61 + (byte % 26))
        : (byte % 36).toString(36),
  ).join('');
}

function notifyObservers(
  observers: LinkedList<SessionObserver>,
  event: SessionEvent,
): void {
  for (let node = observers.front(); node !== null; node = node.next) {
    node.value.onSessionEvent(event);
  }
}

function processError(
  id: number,
  error: unknown,
  coroutine: Coroutine,
  observers: LinkedList<SessionObserver>,
): void {
  let captured = false;

  try {
    handleError(error, coroutine.scope, coroutine);
    captured = true;
  } catch (error) {
    captured = error instanceof InterruptError;
    throw error;
  } finally {
    notifyObservers(observers, {
      type: 'render-error',
      id,
      error,
      captured,
    });
  }
}

function resetRenderFrame(frame: RenderFrame): void {
  frame.pendingCoroutines.length = 0;
  frame.mutationEffects.clear();
  frame.layoutEffects.clear();
  frame.passiveEffects.clear();
}
