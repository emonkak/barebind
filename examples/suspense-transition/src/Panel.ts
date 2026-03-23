import { createComponent, html } from 'barebind';

export interface PanelProps {
  children: unknown;
}

export const Panel = createComponent<PanelProps>(function Panel({ children }) {
  return html`
    <section class="panel">
      <${children}>
    </section>
  `;
});
