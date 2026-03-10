import { createComponent } from 'barebind';

export interface IndexPageProps {
  navigate: (url: string) => void;
}

export const IndexPage = createComponent<IndexPageProps>(function IndexPage(
  { navigate },
  $,
) {
  return $.html`
    <button @click=${() => navigate('/the-beatles')}>
      Open The Beatles artist page
    </button>
  `;
});
