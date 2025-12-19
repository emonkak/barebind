import { createComponent, type RenderContext, shallowEqual } from 'barebind';

export interface NavProps {}

export const Nav = createComponent(
  function Nav(_props: NavProps, $: RenderContext): unknown {
    return $.html`
    <nav class="inner">
      <a href="#/">
        <strong>HN</strong>
      </a>
      <a href="#/new">
        <strong>New</strong>
      </a>
      <a href="#/show">
        <strong>Show</strong>
      </a>
      <a href="#/ask">
        <strong>Ask</strong>
      </a>
      <a href="#/jobs">
        <strong>Jobs</strong>
      </a>
      <a class="github" href="https://github.com/emonkak/barebind" target="_blank">
        Built with Barebind
      </a>
    </nav>
  `;
  },
  { arePropsEqual: shallowEqual },
);
