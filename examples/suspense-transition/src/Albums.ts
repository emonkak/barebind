import { createComponent, Repeat } from 'barebind';
import { Resource } from 'barebind/addons/suspense';
import { fetchAlbums } from './data.js';

export interface AlbumsProps {
  artistId: string;
}

export const Albums = createComponent<AlbumsProps>(function Albums(
  { artistId },
  $,
) {
  const albums = $.use(Resource(() => fetchAlbums(artistId)));

  return $.html`
    <ul>
      <${Repeat({
        source: albums.unwrap(),
        elementSelector: (album) => $.html`
          <li>
            ${album.title} (${album.year})
          </li>
        `,
      })}>
    </ul>
  `;
});
