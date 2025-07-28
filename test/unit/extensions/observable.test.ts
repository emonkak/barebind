import { describe, expect, it, vi } from 'vitest';
import { Observable } from '@/extensions/observable.js';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

type TodoFilter = 'all' | 'active' | 'completed';

class TodoState {
  todos: readonly Todo[];

  filter: TodoFilter;

  constructor(todos: readonly Todo[] = [], filter: TodoFilter = 'all') {
    this.todos = todos;
    this.filter = filter;
  }

  get activeTodos(): readonly Todo[] {
    return this.getVisibleTodos('active');
  }

  get visibleTodos(): readonly Todo[] {
    return this.getVisibleTodos(this.filter);
  }

  addTodo(title: string) {
    this.todos = this.todos.concat({
      id: this.todos.length,
      title,
      completed: false,
    });
  }

  changeFilter(filter: TodoFilter) {
    this.filter = filter;
  }

  getVisibleTodos(filter: TodoFilter): readonly Todo[] {
    switch (filter) {
      case 'active':
        return this.todos.filter((todo) => !todo.completed);
      case 'completed':
        return this.todos.filter((todo) => todo.completed);
      default:
        return this.todos;
    }
  }
}

describe('Observable', () => {
  describe('length', () => {
    it('returns a length of the array', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);
      const state$ = Observable.from(initialState);
      const todos$ = state$.get('todos');
      const filter$ = state$.get('filter');

      expect(todos$).toHaveLength(2);
      expect(filter$).toHaveLength(0);
    });
  });

  describe('value', () => {
    it('returns the initial state as a snapshot if there is no update', () => {
      const initialState = new TodoState();
      const state$ = Observable.from(initialState);

      expect(state$.value).toBe(initialState);
      expect(state$.version).toBe(0);
    });

    it('returns a snapshot with the update applied', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);
      const state$ = Observable.from(initialState);
      const todos$ = state$.get('todos');
      const filter$ = state$.get('filter');

      todos$.value = todos$.value.concat([
        { id: 2, title: 'baz', completed: false },
      ]);
      todos$.get(1)!.value = { id: 1, title: 'bar', completed: true };
      filter$.value = 'active';

      const snapshot = state$.value;

      expect(snapshot).toBeInstanceOf(TodoState);
      expect(snapshot.todos).toStrictEqual([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: true },
        { id: 2, title: 'baz', completed: false },
      ]);
      expect(snapshot.filter).toStrictEqual('active');
      expect(state$.version).toBe(3);
    });

    it('sets a new value to the accessor property', () => {
      const state$ = Observable.from({
        _count: 0,
        get count() {
          return this._count;
        },
        set count(count) {
          this._count = count;
        },
      });

      state$.get('count').value++;

      expect(state$.value).toStrictEqual({ _count: 1, count: 1 });
      expect(state$.version).toBe(1);
    });

    it('assigns a new value as a snapshot', () => {
      const state1 = { count: 0 };
      const state2 = { count: 1 };
      const state$ = Observable.from(state1);

      state$.value = state2;

      expect(state$.value).toBe(state2);
      expect(state$.version).toBe(1);
    });

    it('throws an error when trying to set to a readonly descriptor', () => {
      const initialState = new TodoState();
      const state$ = Observable.from(initialState);
      const activeTodos$ = state$.get('activeTodos');

      expect(() => {
        (activeTodos$ as any).value = [];
      }).toThrow('Cannot set value on a read-only descriptor.');
    });
  });

  describe('diff()', () => {
    it('returns a list of changed properties', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);
      const state$ = Observable.from(initialState);
      const todos$ = state$.get('todos');
      const filter$ = state$.get('filter');

      todos$.get(1)!.get('completed').value = true;
      filter$.value = 'completed';

      expect(state$.diff()).toStrictEqual([
        {
          path: ['todos', 1, 'completed'],
          value: true,
        },
        {
          path: ['filter'],
          value: 'completed',
        },
      ]);
      expect(todos$.diff()).toStrictEqual([
        {
          path: [1, 'completed'],
          value: true,
        },
      ]);
      expect(filter$.diff()).toStrictEqual([
        {
          path: [],
          value: 'completed',
        },
      ]);
    });
  });

  describe('get()', () => {
    it('computes a computed property is calculated from dependent values', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);
      const state$ = Observable.from(initialState);
      const todos$ = state$.get('todos');
      const filter$ = state$.get('filter');
      const activeTodos$ = state$.get('activeTodos');
      const visibleTodos$ = state$.get('visibleTodos');

      expect(activeTodos$.value).toStrictEqual([
        { id: 1, title: 'bar', completed: false },
      ]);
      expect(visibleTodos$.value).toStrictEqual([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);

      todos$.value = todos$.value.concat([
        { id: 2, title: 'baz', completed: false },
      ]);
      filter$.value = 'completed';

      expect(activeTodos$.value).toStrictEqual([
        { id: 1, title: 'bar', completed: false },
        { id: 2, title: 'baz', completed: false },
      ]);
      expect(visibleTodos$.value).toStrictEqual([
        { id: 0, title: 'foo', completed: true },
      ]);
    });

    it('returns undefined if the property does not exist', () => {
      const initialState = new TodoState();
      const state$ = Observable.from(initialState);

      expect(state$.get('todos').get(0)).toBe(null);
      expect(state$.get('filter').get(0)).toBe(null);
    });
  });

  describe('mutate()', () => {
    it('mutates the state by mutation methods', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);
      const state$ = Observable.from(initialState);

      state$.mutate((state) => {
        state.addTodo('baz');
        state.changeFilter('completed');
      });

      const snapshot = state$.value;

      expect(snapshot).toBeInstanceOf(TodoState);
      expect(snapshot.todos).toStrictEqual([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
        { id: 2, title: 'baz', completed: false },
      ]);
      expect(snapshot.filter).toBe('completed');
      expect(state$.version).toBe(2);
    });

    it('mutates the state by an accessor property', () => {
      const state$ = Observable.from({
        _count: 0,
        get count() {
          return this._count;
        },
        set count(count: number) {
          this._count = count;
        },
      });

      const previousCount = state$.mutate((state) => {
        return state.count++;
      });

      expect(previousCount).toBe(0);
      expect(state$.value).toStrictEqual({
        _count: 1,
        count: 1,
      });
    });

    it('throws an error when trying to set a value to the readonly property', () => {
      const state$ = Observable.from({
        _count: 0,
        get count() {
          return this._count;
        },
      });

      expect(() => {
        state$.mutate((state) => {
          (state as any).count++;
        });
      }).toThrow();
    });

    it('throws an error when trying to mutate a readonly descriptor', () => {
      const state$ = Observable.from({
        _count: 0,
        get count() {
          return this._count;
        },
      });

      expect(() => state$.get('count').mutate(() => {})).toThrow(
        'Cannot mutate value with a readonly descriptor.',
      );
    });

    it('throws an error when trying to mutate to a non-object descriptor', () => {
      const state$ = Observable.from('foo');

      expect(() => state$.mutate(() => {})).toThrow(
        'Cannot mutate value with a non-object descriptor.',
      );
    });
  });

  describe('subscribe()', () => {
    it('subscribes for deep updates', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);
      const state$ = Observable.from(initialState);
      const subscriber = vi.fn();

      state$.subscribe(subscriber);
      state$.get('todos').get(1)!.get('completed').value = true;

      expect(subscriber).toHaveBeenCalledTimes(1);

      state$.get('todos').value = [];

      expect(subscriber).toHaveBeenCalledTimes(2);

      state$.value = new TodoState();

      expect(subscriber).toHaveBeenCalledTimes(3);
    });

    it('subscribes only for shallow updates', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);
      const state$ = Observable.from(initialState, { shallow: true });
      const subscriber = vi.fn();

      state$.subscribe(subscriber);
      state$.get('todos').get(1)!.get('completed').value = true;

      expect(subscriber).toHaveBeenCalledTimes(0);

      state$.get('todos').value = [];

      expect(subscriber).toHaveBeenCalledTimes(0);

      state$.value = new TodoState();

      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('do not notify subscribers of updates when the subscription is unsubscribed', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', completed: true },
        { id: 1, title: 'bar', completed: false },
      ]);
      const state$ = Observable.from(initialState);
      const subscriber = vi.fn();

      state$.subscribe(subscriber)();
      state$.get('todos').get(1)!.get('completed').value = true;
      state$.get('todos').value = [];
      state$.value = new TodoState();

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});
