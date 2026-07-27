import { createComponent, html } from 'barebind';

import { TodoStore } from './store.js';
import { TodoInput } from './TodoInput.js';

export interface HeaderProps {}

export const Header = createComponent<HeaderProps>(function Header() {
  const store = this.inject(TodoStore);

  const handleSubmit = (title: string) => {
    store.addTodo(title);
  };

  return html`
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
