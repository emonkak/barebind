import { component, type RenderContext } from '@emonkak/ebit';

import { TodoState } from './state.js';
import { TodoInput } from './TodoInput.js';

export interface HeaderProps {}

export function Header(_props: HeaderProps, context: RenderContext): unknown {
  const todoState$ = context.use(TodoState);

  const handleSubmit = (title: string) => {
    todoState$.mutate((todoState) => {
      todoState.addTodo(title);
    });
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
