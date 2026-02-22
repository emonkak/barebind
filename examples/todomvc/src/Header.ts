import { createComponent, type RenderContext } from 'barebind';

import { TodoStore } from './state.js';
import { TodoInput } from './TodoInput.js';

export interface HeaderProps {}

export const Header = createComponent(function Header(
  _props: HeaderProps,
  $: RenderContext,
): unknown {
  const { state$ } = $.use(TodoStore);

  const handleSubmit = (title: string) => {
    state$.mutate((state) => {
      state.addTodo(title);
    });
  };

  return $.html`
    <header class="header" data-testid="header">
      <h1>todos</h1>
      <${TodoInput({
        onSubmit: handleSubmit,
        placeholder: 'What needs to be done?',
        label: 'New Todo Input',
      })}>
    </header>
  `;
});
