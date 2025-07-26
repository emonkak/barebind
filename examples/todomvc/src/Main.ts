import { component, type RenderContext, repeat } from '@emonkak/ebit';

import { TodoState } from './state.js';
import { TodoItem } from './TodoItem.js';

export interface MainProps {}

export function Main(_props: MainProps, context: RenderContext): unknown {
  const todoState$ = context.use(TodoState);
  const visibleTodos = context.use(todoState$.get('visibleTodos'));

  const handleToggleAll = () => {
    todoState$.mutate((todoState) => {
      todoState.toggleAllTodos();
    });
  };

  return context.html`
    <main class="main" data-testid="main">
      <${
        visibleTodos.length > 0
          ? context.html`
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
        <${repeat({
          source: visibleTodos,
          keySelector: (todo) => todo.id,
          valueSelector: (todo) => component(TodoItem, { todo }),
        })}>
      </ul>
    </main>
  `;
}
