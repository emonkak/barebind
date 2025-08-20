/// <reference path="../typings/scheduler.d.ts" />

import {
  $toDirective,
  CommitPhase,
  type Component,
  type Coroutine,
  createScope,
  type Directive,
  type Effect,
  getFlushLanesFromOptions,
  getScheduleLanesFromOptions,
  type Hook,
  isBindable,
  Lanes,
  type Part,
  type Primitive,
  type Scope,
  type Slot,
  type Template,
  type TemplateMode,
  type UnwrapBindable,
  type UpdateContext,
  type UpdateHandle,
  type UpdateOptions,
} from './internal.js';
import type { LinkedList } from './linked-list.js';
import { RenderSession } from './render-session.js';
import type { Runtime, RuntimeEvent, RuntimeObserver } from './runtime.js';
import type { Literal, TemplateLiteral } from './template-literal.js';

interface UpdateFrame {
  id: number;
  pendingCoroutines: Coroutine[];
  mutationEffects: Effect[];
  layoutEffects: Effect[];
  passiveEffects: Effect[];
}

export class UpdateSession implements UpdateContext {
  private readonly _frame: UpdateFrame;

  private readonly _scope: Scope;

  private readonly _runtime: Runtime;

  static create(runtime: Runtime): UpdateSession {
    const frame: UpdateFrame = {
      id: 0,
      pendingCoroutines: [],
      mutationEffects: [],
      layoutEffects: [],
      passiveEffects: [],
    };
    const scope = createScope(null);
    return new UpdateSession(frame, scope, runtime);
  }

  private constructor(frame: UpdateFrame, scope: Scope, runtime: Runtime) {
    this._frame = frame;
    this._scope = scope;
    this._runtime = runtime;
  }

  addObserver(observer: RuntimeObserver): () => void {
    const observers = this._runtime.observers;
    const node = observers.pushBack(observer);
    return () => {
      observers.remove(node);
    };
  }

  enqueueCoroutine(coroutine: Coroutine): void {
    this._frame.pendingCoroutines.push(coroutine);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._frame.layoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._frame.mutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._frame.passiveEffects.push(effect);
  }

  enterScope(scope: Scope): UpdateSession {
    return new UpdateSession(this._frame, scope, this._runtime);
  }

  expandLiterals<T>(
    strings: TemplateStringsArray,
    values: readonly (T | Literal)[],
  ): TemplateLiteral<T> {
    return this._runtime.templateLiteralPreprocessor.process(strings, values);
  }

  async flushAsync(lanes: Lanes): Promise<void> {
    const { backend, observers } = this._runtime;

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'UPDATE_START',
        id: this._frame.id,
        lanes,
      });
    }

    try {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'RENDER_START',
          id: this._frame.id,
        });
      }

      try {
        while (true) {
          const coroutines = consumeCoroutines(this._frame);

          for (let i = 0, l = coroutines.length; i < l; i++) {
            coroutines[i]!.resume(lanes, this);
          }

          if (this._frame.pendingCoroutines.length === 0) {
            break;
          }

          await backend.yieldToMain();
        }
      } finally {
        if (!observers.isEmpty()) {
          notifyObservers(observers, {
            type: 'RENDER_END',
            id: this._frame.id,
          });
        }
      }

      const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
        this._frame,
      );

      if (mutationEffects.length > 0 || layoutEffects.length > 0) {
        const callback = () => {
          this._commitEffects(mutationEffects, CommitPhase.Mutation);
          this._commitEffects(layoutEffects, CommitPhase.Layout);
        };

        if (lanes & Lanes.ViewTransitionLane) {
          await backend.startViewTransition(callback);
        } else {
          await backend.requestCallback(callback, {
            priority: 'user-blocking',
          });
        }
      }

      if (passiveEffects.length > 0) {
        await backend.requestCallback(
          () => {
            this._commitEffects(passiveEffects, CommitPhase.Passive);
          },
          { priority: 'background' },
        );
      }
    } finally {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'UPDATE_END',
          id: this._frame.id,
          lanes,
        });
      }
    }
  }

  flushSync(lanes: Lanes): void {
    const { observers } = this._runtime;

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'UPDATE_START',
        id: this._frame.id,
        lanes,
      });
    }

    try {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'RENDER_START',
          id: this._frame.id,
        });
      }

      do {
        const coroutines = consumeCoroutines(this._frame);

        for (let i = 0, l = coroutines.length; i < l; i++) {
          coroutines[i]!.resume(lanes, this);
        }
      } while (this._frame.pendingCoroutines.length > 0);

      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'RENDER_END',
          id: this._frame.id,
        });
      }

      const { mutationEffects, layoutEffects, passiveEffects } = consumeEffects(
        this._frame,
      );

      this._commitEffects(mutationEffects, CommitPhase.Mutation);
      this._commitEffects(layoutEffects, CommitPhase.Layout);
      this._commitEffects(passiveEffects, CommitPhase.Passive);
    } finally {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'UPDATE_END',
          id: this._frame.id,
          lanes,
        });
      }
    }
  }

  getCurrentScope(): Scope {
    return this._scope;
  }

  getUpdateHandles(): LinkedList<UpdateHandle> {
    return this._runtime.updateHandles;
  }

  nextIdentifier(): string {
    const prefix = this._runtime.templatePlaceholder;
    const id = incrementIdentifier(this._runtime.identifierCount);
    this._runtime.identifierCount = id;
    return prefix + ':' + id;
  }

  renderComponent<TProps, TResult>(
    component: Component<TProps, TResult>,
    props: TProps,
    lanes: Lanes,
    hooks: Hook[],
    coroutine: Coroutine,
  ): TResult {
    const { observers } = this._runtime;
    const session = new RenderSession(lanes, hooks, coroutine, this);

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'COMPONENT_RENDER_START',
        id: this._frame.id,
        component,
        props,
        context: session,
      });
    }

    try {
      const result = component.render(props, session);
      session.finalize();
      return result;
    } finally {
      if (!observers.isEmpty()) {
        notifyObservers(observers, {
          type: 'COMPONENT_RENDER_END',
          id: this._frame.id,
          component,
          props,
          context: session,
        });
      }
    }
  }

  resolveDirective<T>(value: T, part: Part): Directive<UnwrapBindable<T>> {
    if (isBindable(value)) {
      return value[$toDirective](part, this) as Directive<UnwrapBindable<T>>;
    } else {
      const type = this._runtime.backend.resolvePrimitive(value, part);
      type.ensureValue?.(value, part);
      return {
        type: type as Primitive<UnwrapBindable<T>>,
        value: value as UnwrapBindable<T>,
      };
    }
  }

  resolveSlot<T>(value: T, part: Part): Slot<T> {
    const directive = this.resolveDirective(value, part);
    const binding = directive.type.resolveBinding(directive.value, part, this);
    const slotType =
      directive.slotType ?? this._runtime.backend.resolveSlotType(value, part);
    return new slotType(binding);
  }

  resolveTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    const { backend, cachedTemplates, templatePlaceholder } = this._runtime;
    let template = cachedTemplates.get(strings);

    if (template === undefined) {
      template = backend
        .getTemplateFactory()
        .parseTemplate(strings, binds, templatePlaceholder, mode);
      cachedTemplates.set(strings, template);
    }

    return template;
  }

  scheduleUpdate(
    coroutine: Coroutine,
    options: UpdateOptions = {},
  ): UpdateHandle {
    const { backend, concurrent, updateHandles } = this._runtime;
    const completeOptions: Required<UpdateOptions> = {
      concurrent: options.concurrent ?? concurrent,
      priority: options.priority ?? backend.getCurrentPriority(),
      viewTransition: options.viewTransition ?? false,
    };
    const scheduleLanes = getScheduleLanesFromOptions(completeOptions);

    for (let node = updateHandles.front(); node !== null; node = node.next) {
      const updateHandle = node.value;
      if (
        updateHandle.coroutine === coroutine &&
        updateHandle.lanes === scheduleLanes &&
        !updateHandle.running
      ) {
        return updateHandle;
      }
    }

    coroutine.suspend(scheduleLanes, this);

    const updateHandleNode = updateHandles.pushBack({
      coroutine,
      lanes: scheduleLanes,
      promise: backend.requestCallback(async () => {
        try {
          if ((coroutine.pendingLanes & scheduleLanes) !== scheduleLanes) {
            return;
          }

          updateHandleNode.value.running = true;

          const subcontext = this._enterFrame(coroutine);
          const flushLanes = getFlushLanesFromOptions(completeOptions);

          if (completeOptions.concurrent) {
            await subcontext.flushAsync(flushLanes);
          } else {
            subcontext.flushSync(flushLanes);
          }
        } finally {
          updateHandles.remove(updateHandleNode);
        }
      }, completeOptions),
      running: false,
    });

    return updateHandleNode.value;
  }

  private _commitEffects(effects: Effect[], phase: CommitPhase): void {
    const { backend, observers } = this._runtime;

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'COMMIT_START',
        id: this._frame.id,
        effects,
        phase,
      });
    }

    backend.commitEffects(effects, phase);

    if (!observers.isEmpty()) {
      notifyObservers(observers, {
        type: 'COMMIT_END',
        id: this._frame.id,
        effects,
        phase,
      });
    }
  }

  private _enterFrame(coroutine: Coroutine): UpdateSession {
    const updateCount = incrementIdentifier(this._runtime.updateCount);
    const frame: UpdateFrame = {
      id: updateCount,
      pendingCoroutines: [coroutine],
      mutationEffects: [],
      layoutEffects: [],
      passiveEffects: [],
    };

    this._runtime.updateCount = updateCount;

    return new UpdateSession(frame, this._scope, this._runtime);
  }
}

function consumeCoroutines(frame: UpdateFrame): Coroutine[] {
  const { pendingCoroutines } = frame;
  frame.pendingCoroutines = [];
  return pendingCoroutines;
}

function consumeEffects(
  frame: UpdateFrame,
): Pick<UpdateFrame, 'mutationEffects' | 'layoutEffects' | 'passiveEffects'> {
  const { mutationEffects, layoutEffects, passiveEffects } = frame;
  frame.mutationEffects = [];
  frame.layoutEffects = [];
  frame.passiveEffects = [];
  return {
    mutationEffects,
    layoutEffects,
    passiveEffects,
  };
}

function incrementIdentifier(id: number): number {
  return (id % Number.MAX_SAFE_INTEGER) + 1;
}

function notifyObservers(
  observers: LinkedList<RuntimeObserver>,
  event: RuntimeEvent,
): void {
  for (let node = observers.front(); node !== null; node = node.next) {
    node.value.onRuntimeEvent(event);
  }
}
