import type { RenderContext } from '@emonkak/ebit';
import { navigateHandler } from '@emonkak/ebit/router.js';

export interface NavProps {}

export function Nav(_props: NavProps, context: RenderContext) {
  const handleNavigate = context.use(navigateHandler());

  return context.html`
    <header class="header">
      <nav class="inner">
        <a href="/" @click=${handleNavigate}>
          <strong>HN</strong>
        </a>
        <a href="/new" @click=${handleNavigate}>
          <strong>New</strong>
        </a>
        <a href="/show" @click=${handleNavigate}>
          <strong>Show</strong>
        </a>
        <a href="/ask" @click=${handleNavigate}>
          <strong>Ask</strong>
        </a>
        <a href="/jobs" @click=${handleNavigate}>
          <strong>Jobs</strong>
        </a>
        <a class="github" href="http://github.com/emonkak/ebit" target="_blank">
          Built with Ebit
        </a>
      </nav>
    </header>
  `;
}
