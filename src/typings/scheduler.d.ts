interface Scheduler {
  postTask<T>(
    callback: () => T | PromiseLike<T>,
    options?: SchedulerPostTaskOptions,
  ): Promise<T>;
  yield(options?: SchedulerYieldOptions): Promise<void>;
}

interface SchedulerPostTaskOptions {
  delay?: number;
  priority?: TaskPriority;
  signal?: TaskSignal;
}

interface SchedulerYieldOptions {
  priority?: TaskPriority | 'inherit';
  signal?: TaskSignal | 'inherit';
}

declare var Scheduler: {
  prototype: Scheduler;
  new (): Scheduler;
};

declare var scheduler: Scheduler;

interface TaskController extends AbortController {
  readonly signal: TaskSignal;
  setPriority(priority: TaskPriority): void;
}

declare var TaskController: {
  prototype: TaskController;
  new (): TaskController;
};

interface TaskSignal extends AbortSignal {
  readonly priority: TaskPriority;
  onprioritychange: ((this: TaskSignal, ev: Event) => any) | null;
  addEventListener<K extends keyof TaskSignalEventMap>(
    type: K,
    listener: (this: TaskSignal, ev: TaskSignalEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof TaskSignalEventMap>(
    type: K,
    listener: (this: TaskSignal, ev: TaskSignalEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface TaskSignalEventMap {
  prioritychange: TaskPriorityChangeEvent;
}

declare var TaskSignal: {
  prototype: TaskSignal;
  new (): TaskSignal;
};

interface TaskPriorityChangeEvent extends Event {
  readonly previousPriority: TaskPriority;
}

interface TaskPriorityChangeEventInit extends EventInit {
  previousPriority?: TaskPriority;
}

declare var TaskPriorityChangeEvent: {
  prototype: TaskPriorityChangeEvent;
  new (
    type: string,
    eventInitDict: TaskPriorityChangeEventInit,
  ): TaskPriorityChangeEvent;
};

type TaskPriority = 'user-blocking' | 'user-visible' | 'background';
