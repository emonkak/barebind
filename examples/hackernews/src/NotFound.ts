import { createComponent, type RenderContext } from 'barebind';
import type { RelativeURL } from 'barebind/extras/router';

export interface NotFoundProps {
  url: RelativeURL;
}

export const NotFound = createComponent(function NotFound(
  { url }: NotFoundProps,
  $: RenderContext,
): unknown {
  return $.html`
    <div class="error-view">
      <h1>Page ${url} not found.</h1>
    </div>
  `;
});
