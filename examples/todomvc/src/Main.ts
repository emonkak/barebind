import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import { component, keyedList, memo, when } from '@emonkak/ebit/directives.js';

import { TodoItem } from './TodoItem.js';
import { TodoState } from './state.js';

export interface MainProps {}

export function Main(
  _props: MainProps,
  context: RenderContext,
): TemplateResult {
  const state = context.use(TodoState);
  const visibleTodos = context.use(state.visibleTodos$);

  const handleToggleAll = () => {
    state.toggleAllTodos();
  };

  return context.html`
    <main class="main" data-testid="main">
      <${when(
        visibleTodos.length > 0,
        () => context.html`
          <div class="toggle-all-container">
            <input
              class="toggle-all"
              type="checkbox"
              data-testid="toggle-all"
              .checked=${visibleTodos.every((todo$) => todo$.value.completed)}
              @change=${handleToggleAll}
            >
            <label class="toggle-all-label" htmlFor="toggle-all">
              Toggle All Input
            </label>
          </div>
        `,
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
