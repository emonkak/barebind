import { $customHook, type HookContext } from 'barebind';
import { Reactive } from 'barebind/extras/reactive';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export type TodoFilter = 'all' | 'active' | 'completed';

export class TodoState {
  todos: readonly Todo[] = [];

  filter: TodoFilter = 'all';

  static [$customHook](context: HookContext): Reactive<TodoState> {
    const state = context.getContextValue(TodoState);
    if (!(state instanceof Reactive && state.value instanceof TodoState)) {
      throw new Error(`${TodoState.name} is not registered in this context.`);
    }
    return state;
  }

  [$customHook](context: HookContext): void {
    context.setContextValue(this.constructor, Reactive.from(this));
  }

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

  addTodo(title: string): void {
    this.todos = this.todos.concat({
      id: getUUID(),
      title,
      completed: false,
    });
  }

  clearCompletedTodos(): void {
    this.todos = this.todos.filter((todo) => !todo.completed);
  }

  removeTodo(id: string): void {
    this.todos = this.todos.filter((todo) => todo.id !== id);
  }

  toggleTodo(id: string): void {
    this.todos = this.todos.map((todo) => {
      if (todo.id !== id) {
        return todo;
      }
      return { ...todo, completed: !todo.completed };
    });
  }

  toggleAllTodos(): void {
    this.todos = this.todos.map((todo) => ({
      ...todo,
      completed: !todo.completed,
    }));
  }

  updateTodo(id: string, title: string): void {
    this.todos = this.todos.map((todo) => {
      if (todo.id !== id) {
        return todo;
      }
      return { ...todo, title };
    });
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
