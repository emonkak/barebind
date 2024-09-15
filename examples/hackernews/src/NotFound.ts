import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import type { RelativeURL } from '@emonkak/ebit/router.js';

export interface NotFoundProps {
  url: RelativeURL;
}

export function NotFound(
  { url }: NotFoundProps,
  context: RenderContext,
): TemplateResult {
  return context.html`
    <div class="error-view">
      <h1>Page ${url} not found.</h1>
    </div>
  `;
}
