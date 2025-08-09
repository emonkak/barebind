import type { RenderContext } from 'barebind';

import { type TodoFilter, TodoState } from './state.js';

export interface FooterProps {}

export function Footer(_props: FooterProps, $: RenderContext): unknown {
  const todoState$ = $.use(TodoState);
  const { todos, activeTodos, filter } = $.use(todoState$);

  const handleChangeFilter = (newFilter: TodoFilter) => (event: Event) => {
    event.preventDefault();
    todoState$.mutate((todoState) => {
      todoState.filter = newFilter;
    });
  };

  const handleRemoveCompletedTodos = (event: Event) => {
    event.preventDefault();
    todoState$.mutate((todoState) => {
      todoState.clearCompletedTodos();
    });
  };

  if (todos.length === 0) {
    return null;
  }

  return $.html`
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
