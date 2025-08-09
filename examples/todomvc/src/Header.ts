import { component, type RenderContext } from 'barebind';

import { TodoState } from './state.js';
import { TodoInput } from './TodoInput.js';

export interface HeaderProps {}

export function Header(_props: HeaderProps, $: RenderContext): unknown {
  const todoState$ = $.use(TodoState);

  const handleSubmit = (title: string) => {
    todoState$.mutate((todoState) => {
      todoState.addTodo(title);
    });
  };

  return $.html`
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
