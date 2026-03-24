import { createComponent, html } from 'barebind';

import { TodoStore } from './state.js';
import { TodoItem } from './TodoItem.js';

export interface MainProps {}

export const Main = createComponent<MainProps>(function Main(_props, $) {
  const { state$ } = $.use(TodoStore);
  const visibleTodos = $.use(state$.get('visibleTodos'));

  const handleToggleAll = () => {
    state$.mutate((todoState) => {
      todoState.toggleAllTodos();
    });
  };

  return html`
    <main class="main" data-testid="main">
      <${
        visibleTodos.length > 0
          ? html`
            <div class="toggle-all-container">
              <input
                class="toggle-all"
                type="checkbox"
                data-testid="toggle-all"
                .checked=${visibleTodos.every((todo) => todo.completed)}
                @change=${handleToggleAll}
              >
              <label class="toggle-all-label" for="toggle-all">
                Toggle All Input
              </label>
            </div>
          `
          : null
      }>
      <ul class="todo-list" data-testid="todo-list">
        <${visibleTodos.map((todo) => TodoItem({ todo }).withKey(todo.id))}>
      </ul>
    </main>
  `;
});
