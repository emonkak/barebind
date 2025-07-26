import { describe, expect, it, vi } from 'vitest';
import { Observable } from '@/extensions/observable.js';

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

type TodoFilter = 'all' | 'active' | 'done';

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
      done: false,
    });
  }

  changeFilter(filter: TodoFilter) {
    this.filter = filter;
  }

  getVisibleTodos(filter: TodoFilter): readonly Todo[] {
    switch (filter) {
      case 'active':
        return this.todos.filter((todo) => !todo.done);
      case 'done':
        return this.todos.filter((todo) => todo.done);
      default:
        return this.todos;
    }
  }
}

describe('Observable', () => {
  describe('length', () => {
    it('returns a length of the array', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
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
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
      ]);
      const state$ = Observable.from(initialState);
      const todos$ = state$.get('todos');
      const filter$ = state$.get('filter');

      todos$.value = todos$.value.concat([
        { id: 2, title: 'baz', done: false },
      ]);
      todos$.get(1)!.value = { id: 1, title: 'bar', done: true };
      filter$.value = 'active';

      const snapshot = state$.value;

      expect(snapshot).toBeInstanceOf(TodoState);
      expect(snapshot.todos).toStrictEqual([
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: true },
        { id: 2, title: 'baz', done: false },
      ]);
      expect(snapshot.filter).toStrictEqual('active');
      expect(state$.version).toBe(3);
    });

    it('assigns the new value as a snapshot', () => {
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

      expect(() => (activeTodos$.value = [])).toThrow(
        'Cannot set value on a read-only descriptor.',
      );
    });
  });

  describe('get()', () => {
    it('computes a computed property is calculated from dependent values', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
      ]);
      const state$ = Observable.from(initialState);
      const todos$ = state$.get('todos');
      const filter$ = state$.get('filter');
      const activeTodos$ = state$.get('activeTodos');
      const visibleTodos$ = state$.get('visibleTodos');

      expect(activeTodos$.value).toStrictEqual([
        { id: 1, title: 'bar', done: false },
      ]);
      expect(visibleTodos$.value).toStrictEqual([
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
      ]);

      todos$.value = todos$.value.concat([
        { id: 2, title: 'baz', done: false },
      ]);
      filter$.value = 'done';

      expect(activeTodos$.value).toStrictEqual([
        { id: 1, title: 'bar', done: false },
        { id: 2, title: 'baz', done: false },
      ]);
      expect(visibleTodos$.value).toStrictEqual([
        { id: 0, title: 'foo', done: true },
      ]);
    });

    it('returns undefined if the property does not exist', () => {
      const initialState = new TodoState();
      const state$ = Observable.from(initialState);

      expect(state$.get('' as any)).toBe(undefined);
      expect(state$.get('todos').get(0)).toBe(undefined);
    });
  });

  describe('mutate()', () => {
    it('mutates the state by mutation methods', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
      ]);
      const state$ = Observable.from(initialState);

      state$.mutate((state) => {
        state.addTodo('baz');
        state.changeFilter('done');
      });

      const snapshot = state$.value;

      expect(snapshot).toBeInstanceOf(TodoState);
      expect(snapshot.todos).toStrictEqual([
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
        { id: 2, title: 'baz', done: false },
      ]);
      expect(snapshot.filter).toBe('done');
      expect(state$.version).toBe(2);
    });

    it('mutates the state by accessor properties', () => {
      const state$ = Observable.from({
        _count: 0,
        get count() {
          return this._count;
        },
        set count(count: number) {
          this._count = count;
        },
      });

      state$.mutate((state) => {
        state.count++;
      });

      expect(state$.value).toStrictEqual({
        _count: 1,
        count: 1,
      });
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
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
      ]);
      const state$ = Observable.from(initialState);
      const subscriber = vi.fn();

      state$.subscribe(subscriber);
      state$.get('todos').get(1)!.get('done').value = true;

      expect(subscriber).toHaveBeenCalledTimes(1);

      state$.get('todos').value = [];

      expect(subscriber).toHaveBeenCalledTimes(2);

      state$.value = new TodoState();

      expect(subscriber).toHaveBeenCalledTimes(3);
    });

    it('subscribes only for shallow updates', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
      ]);
      const state$ = Observable.from(initialState, { shallow: true });
      const subscriber = vi.fn();

      state$.subscribe(subscriber);
      state$.get('todos').get(1)!.get('done').value = true;

      expect(subscriber).toHaveBeenCalledTimes(0);

      state$.get('todos').value = [];

      expect(subscriber).toHaveBeenCalledTimes(0);

      state$.value = new TodoState();

      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('do not notify subscribers of updates when the subscription is unsubscribed', () => {
      const initialState = new TodoState([
        { id: 0, title: 'foo', done: true },
        { id: 1, title: 'bar', done: false },
      ]);
      const state$ = Observable.from(initialState);
      const subscriber = vi.fn();

      state$.subscribe(subscriber)();
      state$.get('todos').get(1)!.get('done').value = true;
      state$.get('todos').value = [];
      state$.value = new TodoState();

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});
