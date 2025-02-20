import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import {
  component,
  keyedList,
  memo,
  optional,
} from '@emonkak/ebit/directives.js';

import { TodoItem } from './TodoItem.js';
import { TodoStore } from './store.js';

export interface MainProps {}

export function Main(
  _props: MainProps,
  context: RenderContext,
): TemplateResult {
  const store = context.use(TodoStore);
  const visibleTodos = context.use(store.visibleTodos$);

  const handleToggleAll = () => {
    store.toggleAllTodos();
  };

  return context.html`
    <main class="main" data-testid="main">
      <${optional(
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
          : null,
      )}>
      <ul class="todo-list" data-testid="todo-list">
        <${keyedList(
          visibleTodos,
          (todo$) => todo$.value.id,
          (todo$) => memo(() => component(TodoItem, { todo$ }), [todo$]),
        )}>
      </ul>
    </main>
    `;
}
