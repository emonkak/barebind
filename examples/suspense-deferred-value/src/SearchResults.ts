import { createComponent, Repeat, shallowEqual } from 'barebind';
import { fetchData } from './data.js';

export interface SearchResultsProps {
  query: string;
}

export const SearchResults = createComponent<SearchResultsProps>(
  function SearchResults({ query }, $) {
    if (query === '') {
      return null;
    }
    const albums = fetchData(`/search?q=${query}`).unwrap();
    if (albums.length === 0) {
      return $.html`<p>No matches for <i>"${query}"</i></p>`;
    }
    return $.html`
      <ul>
        <${Repeat({
          source: albums,
          keySelector: (album) => album.id,
          elementSelector: (album) => $.html`
            <li>${album.title} (${album.year})</li>
          `,
        })}>
      </ul>
    `;
  },
  {
    arePropsEqual: shallowEqual,
  },
);
