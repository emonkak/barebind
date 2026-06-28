import { createComponent, html } from 'barebind';

export interface NotFoundProps {
  url: string;
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
