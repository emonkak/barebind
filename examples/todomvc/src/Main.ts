import type { RenderContext, TemplateDirective } from '@emonkak/ebit';
import {
  component,
  memo,
  orderedList,
  when,
} from '@emonkak/ebit/directives.js';

import { TodoItem } from './TodoItem.js';
import { AppState } from './state.js';

export interface MainProps {}

export function Main(
  _props: MainProps,
  context: RenderContext,
): TemplateDirective {
  const state = context.use(AppState);
  const { visibleTodos$ } = state;
  const visibleTodos = context.use(visibleTodos$);

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
        <${orderedList(
          visibleTodos,
          (todo$) => todo$.value.id,
          (todo$) => memo(() => component(TodoItem, { todo$ }), [todo$]),
        )}>
      </ul>
    </main>
    `;
}
