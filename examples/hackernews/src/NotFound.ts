import type { RenderContext } from '@emonkak/ebit';
import type { RelativeURL } from '@emonkak/ebit/extensions/router';

export interface NotFoundProps {
  url: RelativeURL;
}

export function NotFound(
  { url }: NotFoundProps,
  context: RenderContext,
): unknown {
  return context.html`
    <div class="error-view">
      <h1>Page ${url} not found.</h1>
    </div>
  `;
}
