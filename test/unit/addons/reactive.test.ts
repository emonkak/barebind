import { describe, expect, it, vi } from 'vitest';

import { Reactive } from '@/addons/reactive.js';

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
      id: this.todos.length + 1,
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

describe('Reactive', () => {
  describe('value', () => {
    it('returns the initial state as a snapshot if there is no update', () => {
      const initialState = new TodoState();
      const state$ = Reactive.from(initialState);

      expect(state$.value).toBe(initialState);
      expect(state$.version).toBe(0);
    });

    it('returns a snapshot with the update applied', () => {
      const initialState = new TodoState([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
      ]);
      const state$ = Reactive.from(initialState);
      const todos$ = state$.get('todos');
      const filter$ = state$.get('filter');

      todos$.value = todos$.value.concat([
        { id: 3, title: 'baz', completed: false },
      ]);
      todos$.get(1)!.value = { id: 2, title: 'bar', completed: true };
      filter$.value = 'active';

      const snapshot = state$.value;

      expect(snapshot).toBeInstanceOf(TodoState);
      expect(snapshot.todos).toStrictEqual([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: true },
        { id: 3, title: 'baz', completed: false },
      ]);
      expect(snapshot.filter).toStrictEqual('active');
      expect(state$.version).toBe(3);
    });

    it('sets a new value to the accessor property', () => {
      const state$ = Reactive.from({
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
      const state1 = {
        count: 0,
        get doublyCount() {
          return this.count * 2;
        },
      };
      const state2 = {
        count: 1,
        get doublyCount() {
          return this.count * 2;
        },
      };
      const state$ = Reactive.from(state1);

      state$.value = state2;

      expect(state$.value).toBe(state2);
      expect(state$.version).toBe(1);
      expect(state$.get('count').value).toBe(1);
      expect(state$.get('count').version).toBe(1);
      expect(state$.get('doublyCount').value).toBe(2);
      expect(state$.get('doublyCount').version).toBe(1);
    });

    it('throws an error when trying to set to a readonly value', () => {
      const initialState = new TodoState();
      const state$ = Reactive.from(initialState);
      const activeTodos$ = state$.get('activeTodos');

      expect(() => {
        (activeTodos$ as any).value = [];
      }).toThrow('Cannot set value on a read-only value.');
    });
  });

  describe('get()', () => {
    it('returns a computed reactive is calculated from dependent values', () => {
      const initialState = new TodoState([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
      ]);
      const state$ = Reactive.from(initialState);
      const todos$ = state$.get('todos');
      const filter$ = state$.get('filter');
      const activeTodos$ = state$.get('activeTodos');
      const visibleTodos$ = state$.get('visibleTodos');

      expect(activeTodos$.value).toStrictEqual([
        { id: 2, title: 'bar', completed: false },
      ]);
      expect(visibleTodos$.value).toStrictEqual([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
      ]);

      todos$.value = todos$.value.concat([
        { id: 3, title: 'baz', completed: false },
      ]);
      filter$.value = 'completed';

      expect(activeTodos$.value).toStrictEqual([
        { id: 2, title: 'bar', completed: false },
        { id: 3, title: 'baz', completed: false },
      ]);
      expect(visibleTodos$.value).toStrictEqual([
        { id: 1, title: 'foo', completed: true },
      ]);
    });

    it('returns a value of undefined if the property does not exist', () => {
      expect(Reactive.from([0]).get(0).value).toBe(0);
      expect(Reactive.from([0]).get(1).value).toBe(undefined);
    });

    it('returns null if the value is an primitive', () => {
      expect(Reactive.from('foo').get(0)).toBe(null);
      expect(Reactive.from(123).get('toString')).toBe(null);
      expect(Reactive.from(true).get('toString')).toBe(null);
    });
  });

  describe('mutate()', () => {
    it('mutates the state by mutation methods', () => {
      const initialState = new TodoState([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
      ]);
      const state$ = Reactive.from(initialState);

      state$.mutate((state) => {
        state.addTodo('baz');
        state.changeFilter('completed');
      });

      expect(state$.get('todos').value).toStrictEqual([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
        { id: 3, title: 'baz', completed: false },
      ]);
      expect(state$.get('filter').value).toBe('completed');

      const snapshot = state$.value;

      expect(snapshot).toBeInstanceOf(TodoState);
      expect(snapshot.todos).toStrictEqual([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
        { id: 3, title: 'baz', completed: false },
      ]);
      expect(snapshot.filter).toBe('completed');
      expect(state$.version).toBe(2);
    });

    it('mutates the state by an accessor property', () => {
      const state$ = Reactive.from({
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
      const state$ = Reactive.from({
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

    it('throws an error when trying to mutate a readonly value', () => {
      const state$ = Reactive.from({
        _count: 0,
        get count() {
          return this._count;
        },
      });

      expect(() => state$.get('count').mutate(() => {})).toThrow(
        'Cannot mutate value with a readonly value.',
      );
    });

    it('throws an error when trying to mutate to a non-object value', () => {
      const state$ = Reactive.from('foo');

      expect(() => state$.mutate(() => {})).toThrow(
        'Cannot mutate value with a non-object value.',
      );
    });
  });

  describe('subscribe()', () => {
    it('subscribes for deep updates', () => {
      const initialState = new TodoState([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
      ]);
      const state$ = Reactive.from(initialState);
      const subscriber = vi.fn();

      state$.subscribe(subscriber);
      state$.get('todos').get(1).get('completed')!.value = true;

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenLastCalledWith({
        source: expect.objectContaining({ value: true }),
        path: ['todos', 1, 'completed'],
        newValue: true,
        oldValue: false,
      });

      state$.get('todos').value = [];

      expect(subscriber).toHaveBeenCalledTimes(2);
      expect(subscriber).toHaveBeenLastCalledWith({
        source: expect.objectContaining({ value: [] }),
        path: ['todos'],
        newValue: [],
        oldValue: initialState.todos,
      });

      state$.value = new TodoState();

      expect(subscriber).toHaveBeenCalledTimes(3);
      expect(subscriber).toHaveBeenLastCalledWith({
        source: expect.objectContaining({ value: new TodoState() }),
        path: [],
        newValue: new TodoState(),
        oldValue: initialState,
      });
    });

    it('subscribes only for shallow updates', () => {
      const initialState = new TodoState([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
      ]);
      const state$ = Reactive.from(initialState, { shallow: true });
      const subscriber = vi.fn();

      state$.subscribe(subscriber);
      state$.get('todos').get(1).get('completed')!.value = true;

      expect(subscriber).toHaveBeenCalledTimes(0);

      state$.get('todos').value = [];

      expect(subscriber).toHaveBeenCalledTimes(0);

      state$.value = new TodoState();

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenLastCalledWith({
        source: expect.objectContaining({ value: new TodoState() }),
        path: [],
        newValue: new TodoState(),
        oldValue: initialState,
      });
    });

    it('do not notify subscribers of updates when the subscription is unsubscribed', () => {
      const initialState = new TodoState([
        { id: 1, title: 'foo', completed: true },
        { id: 2, title: 'bar', completed: false },
      ]);
      const state$ = Reactive.from(initialState);
      const subscriber = vi.fn();

      state$.subscribe(subscriber)();
      state$.get('todos').get(1).get('completed')!.value = true;
      state$.get('todos').value = [];
      state$.value = new TodoState();

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});
