import { createComponent, html } from 'barebind';
import { DeferredValue } from 'barebind/addons/hooks';
import { Suspense } from 'barebind/addons/suspense';
import { SearchResults } from './SearchResults.js';

export const App = createComponent(function App({}, $) {
  const [query, setQuery] = $.useState('');
  const deferredQuery = $.use(DeferredValue(query, { delay: 100 }));
  const isStale = query !== deferredQuery;
  return html`
    <label>
      Search albums:
      <input
        $value=${query}
        @input=${(event: Event) => {
          setQuery((event.target as HTMLInputElement).value);
        }}
      >
    </label>
    <${Suspense({
      fallback: html`<h2>Loading...</h2>`,
      children: html`
        <div :style=${{ opacity: isStale ? '0.5' : '1' }}>
          <${SearchResults({ query: deferredQuery })}>
        </div>
      `,
    })}>
  `;
});
