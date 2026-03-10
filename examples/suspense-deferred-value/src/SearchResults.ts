import { createComponent, Repeat, shallowEqual } from 'barebind';
import { ResourceLoader } from 'barebind/addons/suspense';
import { searchAlbums } from './data.js';

export interface SearchResultsProps {
  query: string;
}

export const SearchResults = createComponent<SearchResultsProps>(
  function SearchResults({ query }, $) {
    const albumsLoader = $.use(
      ResourceLoader((query: string) => searchAlbums(query), { capacity: 10 }),
    );
    if (query === '') {
      return null;
    }
    const albums = albumsLoader.getOrFetch(query).unwrap();
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
