import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { TodoInput } from './TodoInput.js';
import { TodoStore } from './store.js';

export interface HeaderProps {}

export function Header(
  _props: HeaderProps,
  context: RenderContext,
): TemplateResult {
  const store = context.use(TodoStore);

  const handleSubmit = (title: string) => {
    store.addTodo(title);
  };

  return context.html`
    <header class="header" data-testid="header">
      <h1>todos</h1>
      <${component(TodoInput, {
        onSubmit: handleSubmit,
        placeholder: 'What needs to be done?',
        label: 'New Todo Input',
      })}>
    </header>
  `;
}
