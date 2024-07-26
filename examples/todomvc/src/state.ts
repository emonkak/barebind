import { type RenderContext, usableTag } from '@emonkak/ebit';
import { Atom, Computed, type Signal } from '@emonkak/ebit/directives.js';

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

export class AppState {
  readonly todos$: Atom<Atom<Todo>[]>;
  readonly filter$: Atom<TodoFilter>;
  readonly activeTodos$: Signal<Atom<Todo>[]>;
  readonly visibleTodos$: Signal<Atom<Todo>[]>;

  static [usableTag](context: RenderContext): AppState {
    const state = context.getContextValue(AppState);
    if (!(state instanceof AppState)) {
      throw new Error(
        'A context value for AppState does not exist, please ensure it is registered by context.use(yourAppState).',
      );
    }
    return state;
  }

  constructor() {
    this.filter$ = new Atom(TodoFilter.ALL);
    this.todos$ = new Atom([] as Atom<Todo>[]);
    this.activeTodos$ = new Computed(
      (todos) => todos.value.filter((todo$) => !todo$.value.completed),
      [this.todos$],
    );
    this.visibleTodos$ = new Computed(
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
    context.setContextValue(AppState, this);
  }

  addTodo(title: string): void {
    this.todos$.value = this.todos$.value.concat(
      new Atom({
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
  if (typeof crypto.randomUUID === 'function') {
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
