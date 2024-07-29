import type { RenderContext, TemplateDirective } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { Footer } from './Footer.js';
import { Header } from './Header.js';
import { Main } from './Main.js';
import type { AppState } from './state.js';

interface AppProps {
  state: AppState;
}

export function App(
  { state }: AppProps,
  context: RenderContext,
): TemplateDirective {
  context.use(state);

  return context.html`
    <section class="todoapp">
      <${component(Header, {})}>
      <${component(Main, {})}>
      <${component(Footer, {})}>
    </section>
    <footer class="info">
      <p>Double-click to edit a todo</p>
      <p>Created by the TodoMVC Team</p>
      <p>Part of <a href="http://todomvc.com">TodoMVC</a></p>
    </footer>
  `;
}
