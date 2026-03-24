import { createComponent, html, shallowEqual } from 'barebind';
import { fetchData } from './data.js';

export interface SearchResultsProps {
  query: string;
}

export const SearchResults = createComponent<SearchResultsProps>(
  function SearchResults({ query }) {
    if (query === '') {
      return null;
    }
    const albums = fetchData(`/search?q=${query}`).unwrap();
    if (albums.length === 0) {
      return html`<p>No matches for <i>"${query}"</i></p>`;
    }
    return html`
      <ul>
        <${albums.map((album) =>
          html`
            <li>${album.title} (${album.year})</li>
          `.withKey(album.id),
        )}>
      </ul>
    `;
  },
  {
    arePropsEqual: shallowEqual,
  },
);
