import { type RenderContext, usableTag } from '@emonkak/ebit';
import {
  type Signal,
  type State,
  computed,
  state,
} from '@emonkak/ebit/directives.js';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export enum TodoFilter {
  ALL,
  ACTIVE,
  COMPLETED,
}

export class TodoState {
  readonly todos$ = state<State<Todo>[]>([]);

  readonly filter$ = state(TodoFilter.ALL);

  readonly activeTodos$: Signal<State<Todo>[]>;

  readonly visibleTodos$: Signal<State<Todo>[]>;

  static [usableTag](context: RenderContext): TodoState {
    const state = context.getContextValue(TodoState);
    if (!(state instanceof TodoState)) {
      throw new Error(
        'A context value for TodoState does not exist, please ensure it is registered by context.use(...).',
      );
    }
    return state;
  }

  constructor() {
    this.todos$ = state([] as State<Todo>[]);
    this.activeTodos$ = computed(
      (todos$) => todos$.value.filter((todo$) => !todo$.value.completed),
      [this.todos$],
    );
    this.visibleTodos$ = computed(
      (todos$, filter$) => {
        switch (filter$.value) {
          case TodoFilter.ALL:
            return todos$.value;
          case TodoFilter.ACTIVE:
            return todos$.value.filter((todo$) => !todo$.value.completed);
          case TodoFilter.COMPLETED:
            return todos$.value.filter((todo$) => todo$.value.completed);
        }
      },
      [this.todos$, this.filter$],
    );
  }

  [usableTag](context: RenderContext): void {
    context.setContextValue(TodoState, this);
  }

  addTodo(title: string): void {
    this.todos$.value = this.todos$.value.concat(
      state<Todo>({
        id: getUUID(),
        title,
        completed: false,
      }),
    );
  }

  clearCompletedTodos(): void {
    this.todos$.value = this.todos$.value.filter(
      (todo$) => !todo$.value.completed,
    );
  }

  removeTodo(id: string): void {
    this.todos$.value = this.todos$.value.filter(
      (todo$) => todo$.value.id !== id,
    );
  }

  toggleTodo(id: string): void {
    const todos = this.todos$.value;
    for (let i = 0, l = todos.length; i < l; i++) {
      const todo$ = todos[i]!;
      if (todo$.value.id === id) {
        this.todos$.notifyUpdate();
        todo$.value = { ...todo$.value, completed: !todo$.value.completed };
        break;
      }
    }
  }

  toggleAllTodos(): void {
    this.todos$.notifyUpdate();
    const todos = this.todos$.value;
    for (let i = 0, l = todos.length; i < l; i++) {
      const todo$ = todos[i]!;
      todo$.value = { ...todo$.value, completed: !todo$.value.completed };
    }
  }

  updateTodo(id: string, title: string): void {
    const todos = this.todos$.value;
    for (let i = 0, l = todos.length; i < l; i++) {
      const todo$ = todos[i]!;
      if (todo$.value.id === id) {
        this.todos$.notifyUpdate();
        todo$.value = { ...todo$.value, title };
        break;
      }
    }
  }
}

function getUUID(): ReturnType<typeof crypto.randomUUID> {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  } else {
    const s = [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const p1 = s.slice(0, 8);
    const p2 = s.slice(8, 12);
    const p3 = s.slice(12, 16);
    const p4 = s.slice(16, 20);
    const p5 = s.slice(20, 32);
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  }
}
