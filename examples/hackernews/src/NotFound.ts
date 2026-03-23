import { createComponent, html } from 'barebind';
import type { RelativeURL } from 'barebind/addons/router';

export interface NotFoundProps {
  url: RelativeURL;
}

export const NotFound = createComponent<NotFoundProps>(function NotFound({
  url,
}) {
  return html`
    <div class="error-view">
      <h1>Page ${url} not found.</h1>
    </div>
  `;
});
