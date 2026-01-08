import { createComponent, type RenderContext, Repeat } from 'barebind';

import { TodoState } from './state.js';
import { TodoItem } from './TodoItem.js';

export interface MainProps {}

export const Main = createComponent(function Main(
  _props: MainProps,
  $: RenderContext,
): unknown {
  const todoState$ = $.use(TodoState);
  const visibleTodos = $.use(todoState$.get('visibleTodos'));

  const handleToggleAll = () => {
    todoState$.mutate((todoState) => {
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
          items: visibleTodos,
          keySelector: (todo) => todo.id,
          valueSelector: (todo) => TodoItem({ todo }),
        })}>
      </ul>
    </main>
  `;
});
