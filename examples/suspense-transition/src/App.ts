import { createComponent, html } from 'barebind';
import { Transition } from 'barebind/addons/hooks';
import { Suspense } from 'barebind/addons/suspense';
import { ArtistPage } from './ArtistPage.js';
import { IndexPage } from './IndexPage.js';
import { Layout } from './Layout.js';

export const App = createComponent(function App() {
  return Suspense({
    fallback: BigSpinner({}),
    children: Router({}),
  });
});

const Router = createComponent(function Router(_props, $) {
  const [page, setPage] = $.useState('/');
  const [isPending, startTransition] = $.use(Transition());

  const navigate = (url: string): void => {
    startTransition((transition) => {
      setPage(url, { transition });
    });
  };

  let content: unknown;

  if (page === '/') {
    content = IndexPage({
      navigate,
    });
  } else if (page === '/the-beatles') {
    content = ArtistPage({
      artist: {
        id: 'the-beatles',
        name: 'The Beatles',
      },
    });
  }

  return Layout({
    isPending,
    children: content,
  });
});

const BigSpinner = createComponent(function BigSpinner(_props) {
  return html`
    <h2>🌀 Loading...</h2>
  `;
});
