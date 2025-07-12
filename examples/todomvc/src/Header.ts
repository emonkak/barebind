import type { RenderContext } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/extensions';

import { TodoStore } from './store.js';
import { TodoInput } from './TodoInput.js';

export interface HeaderProps {}

export function Header(_props: HeaderProps, context: RenderContext): unknown {
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
