import { createHydrationTree, replaceMarkerNode } from './hydration.js';
import {
  type Coroutine,
  type Effect,
  Lanes,
  PartType,
  type ScheduleOptions,
  type Slot,
} from './internal.js';
import {
  Runtime,
  type RuntimeBackend,
  type RuntimeObserver,
} from './runtime.js';

const DEFAULT_OPTIONS: ScheduleOptions = {
  immediate: true,
};

export class Root<T> {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  private readonly _runtime: Runtime;

  static create<T>(
    value: T,
    container: Element,
    backend: RuntimeBackend,
  ): Root<T> {
    const runtime = new Runtime(backend);
    const part = {
      type: PartType.ChildNode,
      node: container.ownerDocument.createComment(''),
      anchorNode: null,
      namespaceURI: container.namespaceURI,
    };
    const slot = runtime.resolveSlot(value, part);
    return new Root(slot, container, runtime);
  }

  private constructor(slot: Slot<T>, container: Element, runtime: Runtime) {
    this._slot = slot;
    this._container = container;
    this._runtime = runtime;
  }

  observe(observer: RuntimeObserver): () => void {
    return this._runtime.addObserver(observer);
  }

  hydrate(options?: ScheduleOptions): Promise<void> {
    const coroutine: Coroutine = {
      resume: (context) => {
        const target = createHydrationTree(this._container);
        this._slot.hydrate(target, context);
        replaceMarkerNode(target, this._slot.part.node as Comment);
        context.frame.mutationEffects.push(
          new MountSlot(this._slot, this._container),
        );
        coroutine.pendingLanes &= ~context.frame.lanes;
      },
      pendingLanes: Lanes.DefaultLane,
    };
    return this._runtime.scheduleUpdate(coroutine, {
      ...DEFAULT_OPTIONS,
      ...options,
    }).finished;
  }

  mount(options?: ScheduleOptions): Promise<void> {
    const coroutine: Coroutine = {
      resume: (context) => {
        this._slot.connect(context);
        context.frame.mutationEffects.push(
          new MountSlot(this._slot, this._container),
        );
        coroutine.pendingLanes &= ~context.frame.lanes;
      },
      pendingLanes: Lanes.DefaultLane,
    };
    return this._runtime.scheduleUpdate(coroutine, {
      ...DEFAULT_OPTIONS,
      ...options,
    }).finished;
  }

  update(value: T, options?: ScheduleOptions): Promise<void> {
    const coroutine: Coroutine = {
      resume: (context) => {
        this._slot.reconcile(value, context);
        context.frame.mutationEffects.push(this._slot);
        coroutine.pendingLanes &= ~context.frame.lanes;
      },
      pendingLanes: Lanes.DefaultLane,
    };
    return this._runtime.scheduleUpdate(coroutine, {
      ...DEFAULT_OPTIONS,
      ...options,
    }).finished;
  }

  unmount(options?: ScheduleOptions): Promise<void> {
    const coroutine: Coroutine = {
      resume: (context) => {
        this._slot.disconnect(context);
        context.frame.mutationEffects.push(
          new UnmountSlot(this._slot, this._container),
        );
        coroutine.pendingLanes &= ~context.frame.lanes;
      },
      pendingLanes: Lanes.DefaultLane,
    };
    return this._runtime.scheduleUpdate(coroutine, {
      ...DEFAULT_OPTIONS,
      ...options,
    }).finished;
  }
}

class MountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    this._container.appendChild(this._slot.part.node);
    this._slot.commit();
  }
}

class UnmountSlot<T> implements Effect {
  private readonly _slot: Slot<T>;

  private readonly _container: Element;

  constructor(slot: Slot<T>, container: Element) {
    this._slot = slot;
    this._container = container;
  }

  commit(): void {
    this._slot.rollback();
    this._container.removeChild(this._slot.part.node);
  }
}
