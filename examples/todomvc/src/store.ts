import { Atom, defineStore } from '@emonkak/ebit/extensions';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export type TodoFilter = 'all' | 'active' | 'completed';

export const TodoStore = defineStore(
  class TodoStore {
    todos: readonly Atom<Todo>[] = [];

    filter: TodoFilter = 'all';

    get activeTodos(): readonly Atom<Todo>[] {
      return this.todos.filter((todo$) => !todo$.value.completed);
    }

    get visibleTodos(): readonly Atom<Todo>[] {
      switch (this.filter) {
        case 'all':
          return this.todos;
        case 'active':
          return this.todos.filter((todo$) => !todo$.value.completed);
        case 'completed':
          return this.todos.filter((todo$) => todo$.value.completed);
        default:
          return [];
      }
    }

    addTodo(title: string): void {
      this.todos = this.todos.concat(
        new Atom<Todo>({
          id: getUUID(),
          title,
          completed: false,
        }),
      );
    }

    clearCompletedTodos(): void {
      this.todos = this.todos.filter((todo$) => !todo$.value.completed);
    }

    removeTodo(id: string): void {
      this.todos = this.todos.filter((todo$) => todo$.value.id !== id);
    }

    toggleTodo(id: string): void {
      this.todos = this.todos.map((todo$) => {
        if (todo$.value.id === id) {
          this.todos = this.todos;
          todo$.value = { ...todo$.value, completed: !todo$.value.completed };
        }
        return todo$;
      });
    }

    toggleAllTodos(): void {
      this.todos = this.todos.map((todo$) => {
        todo$.value = { ...todo$.value, completed: !todo$.value.completed };
        return todo$;
      });
    }

    updateTodo(id: string, title: string): void {
      this.todos = this.todos.map((todo$) => {
        if (todo$.value.id === id) {
          todo$.value = { ...todo$.value, title };
        }
        return todo$;
      });
    }
  },
);

export type TodoStore = InstanceType<typeof TodoStore>;

function getUUID(): ReturnType<typeof crypto.randomUUID> {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  } else {
    const s = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const p1 = s.slice(0, 8);
    const p2 = s.slice(8, 12);
    const p3 = s.slice(12, 16);
    const p4 = s.slice(16, 20);
    const p5 = s.slice(20, 32);
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  }
}
