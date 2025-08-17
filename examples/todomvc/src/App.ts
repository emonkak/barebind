import { createComponent, type RenderContext } from 'barebind';

import { Footer } from './Footer.js';
import { Header } from './Header.js';
import { Main } from './Main.js';
import type { TodoState } from './state.js';

interface AppProps {
  state: TodoState;
}

export const App = createComponent(function App(
  { state }: AppProps,
  $: RenderContext,
): unknown {
  $.use(state);

  return $.html`
    <section class="todoapp">
      <${Header({})}>
      <${Main({})}>
      <${Footer({})}>
    </section>
    <footer class="info">
      <p>Double-click to edit a todo</p>
      <p>Part of <a href="http://todomvc.com">TodoMVC</a></p>
    </footer>
  `;
});
