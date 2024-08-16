import type { RenderContext, TemplateDirective } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { TodoInput } from './TodoInput.js';
import { TodoState } from './state.js';

export interface HeaderProps {}

export function Header(
  _props: HeaderProps,
  context: RenderContext,
): TemplateDirective {
  const state = context.use(TodoState);

  const handleSubmit = (title: string) => {
    state.addTodo(title);
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
