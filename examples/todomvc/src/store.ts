import { Derivable } from 'barebind/addons/signal';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export type TodoFilter = 'all' | 'active' | 'completed';

export class TodoState {
  todos: Todo[] = [];
  filter: TodoFilter = 'all';

  get activeTodos(): readonly Todo[] {
    return this.todos.filter((todo) => !todo.completed);
  }

  get visibleTodos(): readonly Todo[] {
    switch (this.filter) {
      case 'all':
        return this.todos;
      case 'active':
        return this.todos.filter((todo) => !todo.completed);
      case 'completed':
        return this.todos.filter((todo) => todo.completed);
      default:
        return [];
    }
  }
}

export class TodoStore {
  readonly state$: Derivable<TodoState>;

  constructor(initialState: TodoState) {
    this.state$ = Derivable.from(initialState);
  }

  addTodo(title: string): void {
    this.state$.get('todos').scope((todos) => {
      todos.push({
        id: getUUID(),
        title,
        completed: false,
      });
    });
  }

  changeFilter(filter: TodoFilter): void {
    this.state$.scope((state) => {
      state.filter = filter;
    });
  }

  clearCompletedTodos(): void {
    this.state$.scope((state) => {
      state.todos = state.todos.filter((todo) => !todo.completed);
    });
  }

  removeTodo(id: string): void {
    this.state$.scope((state) => {
      state.todos = state.todos.filter((todo) => todo.id !== id);
    });
  }

  toggleTodo(id: string): void {
    this.state$.get('todos').scope(
      (todos) => {
        for (const todo of todos) {
          if (todo.id === id) {
            todo.completed = !todo.completed;
          }
        }
      },
      { deep: true },
    );
  }

  toggleAllTodos(): void {
    this.state$.get('todos').scope(
      (todos) => {
        for (const todo of todos) {
          todo.completed = !todo.completed;
        }
      },
      { deep: true },
    );
  }

  updateTodo(id: string, title: string): void {
    this.state$.get('todos').scope(
      (todos) => {
        for (const todo of todos) {
          if (todo.id === id) {
            todo.title = title;
          }
        }
      },
      { deep: true },
    );
  }
}

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
