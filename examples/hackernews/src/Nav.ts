import type { RenderContext } from '@emonkak/ebit';

export interface NavProps {}

export function Nav(_props: NavProps, context: RenderContext) {
  return context.html`
    <header class="header">
      <nav class="inner">
        <a href="/">
          <strong>HN</strong>
        </a>
        <a href="/new">
          <strong>New</strong>
        </a>
        <a href="/show">
          <strong>Show</strong>
        </a>
        <a href="/ask">
          <strong>Ask</strong>
        </a>
        <a href="/jobs">
          <strong>Jobs</strong>
        </a>
        <a class="github" href="http://github.com/emonkak/ebit" target="_blank">
          Built with Ebit
        </a>
      </nav>
    </header>
  `;
}
