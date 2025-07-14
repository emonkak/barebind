import type { RenderContext } from '@emonkak/ebit';
import { component, repeat } from '@emonkak/ebit/extensions';

import { TodoStore } from './store.js';
import { TodoItem } from './TodoItem.js';

export interface MainProps {}

export function Main(_props: MainProps, context: RenderContext): unknown {
  const store = context.use(TodoStore);
  const visibleTodos = context.use(store.getSignal('visibleTodos'));

  const handleToggleAll = () => {
    store.toggleAllTodos();
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
                .checked=${visibleTodos.every((todo$) => todo$.value.completed)}
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
          keySelector: (todo$) => todo$.value.id,
          valueSelector: (todo$) => component(TodoItem, { todo$ }),
        })}>
      </ul>
    </main>
    `;
}
