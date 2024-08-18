import type { RenderContext } from '@emonkak/ebit';
import { linkClickHandler } from '@emonkak/ebit/router.js';

export interface NavProps {}

export function Nav(_props: NavProps, context: RenderContext) {
  const handleLinkClick = context.use(linkClickHandler());

  return context.html`
    <header class="header">
      <nav class="inner">
        <a href="/" @click=${handleLinkClick}>
          <strong>HN</strong>
        </a>
        <a href="/new" @click=${handleLinkClick}>
          <strong>New</strong>
        </a>
        <a href="/show" @click=${handleLinkClick}>
          <strong>Show</strong>
        </a>
        <a href="/ask" @click=${handleLinkClick}>
          <strong>Ask</strong>
        </a>
        <a href="/jobs" @click=${handleLinkClick}>
          <strong>Jobs</strong>
        </a>
        <a class="github" href="http://github.com/emonkak/ebit" target="_blank">
          Built with Ebit
        </a>
      </nav>
    </header>
  `;
}
