import { createComponent, html } from 'barebind';
import { fetchData } from './data.js';

export interface AlbumsProps {
  artistId: string;
}

export const Albums = createComponent<AlbumsProps>(function Albums({
  artistId,
}) {
  const albums = fetchData(`/${artistId}/albums`).unwrap();

  return html`
    <ul>
      <${albums.map(
        (album) => html`
          <li>
            ${album.title} (${album.year})
          </li>
        `,
      )}>
    </ul>
  `;
});
