import type { RenderContext } from '@emonkak/ebit';

import { type TodoFilter, TodoStore } from './store.js';

export interface FooterProps {}

export function Footer(_props: FooterProps, context: RenderContext): unknown {
  const todoStore = context.use(TodoStore);
  const todos = context.use(todoStore.getSignal('todos'));
  const activeTodos = context.use(todoStore.getSignal('activeTodos'));
  const filter = context.use(todoStore.getSignal('filter'));

  if (todos.length === 0) {
    return null;
  }

  const handleChangeFilter = (newFilter: TodoFilter) => (event: Event) => {
    event.preventDefault();
    todoStore.filter = newFilter;
  };

  const handleRemoveCompletedTodos = (event: Event) => {
    event.preventDefault();
    todoStore.clearCompletedTodos();
  };

  return context.html`
    <footer class="footer" data-testid="footer">
      <span class="todo-count">${activeTodos.length} ${activeTodos.length === 1 ? 'item' : 'items'} left!</span>
      <ul class="filters" data-testid="footer-navigation">
        <li>
          <a
            :classlist=${[{ selected: filter === 'all' }]}
            href="#"
            @click=${handleChangeFilter('all')}
          >
            All
          </a>
        </li>
        <li>
          <a
            :classlist=${[{ selected: filter === 'active' }]}
            href="#"
            @click=${handleChangeFilter('active')}
          >
            Active
          </a>
        </li>
        <li>
          <a
            :classlist=${[{ selected: filter === 'completed' }]}
            href="#"
            @click=${handleChangeFilter('completed')}
          >
            Completed
          </a>
        </li>
      </ul>
      <button
        type="button"
        class="clear-completed"
        disabled=${activeTodos.length === todos.length}
        @click=${handleRemoveCompletedTodos}
      >
        Clear completed
      </button>
    </footer>
  `;
}
