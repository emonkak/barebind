import { createComponent } from 'barebind';

export interface LayoutProps {
  children: unknown;
  isPending: boolean;
}

export const Layout = createComponent<LayoutProps>(function Layout(
  { children, isPending },
  $,
) {
  return $.html`
    <div class="layout">
      <section
        :style=${{ opacity: isPending ? 0.7 : 1 }}
        class="header"
      >
        Music Browser
      </section>
      <main>
        <${children}>
      </main>
    </div>
  `;
});
