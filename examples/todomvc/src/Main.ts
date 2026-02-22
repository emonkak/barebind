import { createComponent, type RenderContext, Repeat } from 'barebind';

import { TodoStore } from './state.js';
import { TodoItem } from './TodoItem.js';

export interface MainProps {}

export const Main = createComponent(function Main(
  _props: MainProps,
  $: RenderContext,
): unknown {
  const { state$ } = $.use(TodoStore);
  const visibleTodos = $.use(state$.get('visibleTodos'));

  const handleToggleAll = () => {
    state$.mutate((todoState) => {
      todoState.toggleAllTodos();
    });
  };

  return $.html`
    <main class="main" data-testid="main">
      <${
        visibleTodos.length > 0
          ? $.html`
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
        <${Repeat({
          elementSelector: (todo) => TodoItem({ todo }),
          keySelector: (todo) => todo.id,
          source: visibleTodos,
        })}>
      </ul>
    </main>
  `;
});
