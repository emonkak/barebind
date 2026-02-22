import { createComponent, type RenderContext } from 'barebind';

import { type TodoFilter, TodoStore } from './state.js';

export interface FooterProps {}

export const Footer = createComponent(function Footer(
  _props: FooterProps,
  $: RenderContext,
): unknown {
  const { state$ } = $.use(TodoStore);
  const { todos, activeTodos, filter } = $.use(state$);

  const handleChangeFilter = (newFilter: TodoFilter) => (event: Event) => {
    event.preventDefault();
    state$.mutate((todoState) => {
      todoState.filter = newFilter;
    });
  };

  const handleRemoveCompletedTodos = (event: Event) => {
    event.preventDefault();
    state$.mutate((todoState) => {
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
            :class=${{ selected: filter === 'all' }}
            href="#"
            @click=${handleChangeFilter('all')}
          >
            All
          </a>
        </li>
        <li>
          <a
            :class=${{ selected: filter === 'active' }}
            href="#"
            @click=${handleChangeFilter('active')}
          >
            Active
          </a>
        </li>
        <li>
          <a
            :class=${{ selected: filter === 'completed' }}
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
});
