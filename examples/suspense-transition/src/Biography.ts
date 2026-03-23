import { createComponent, html } from 'barebind';
import { fetchData } from './data.js';

export interface BiographyProps {
  artistId: string;
}

export const Biography = createComponent<BiographyProps>(function Biography({
  artistId,
}) {
  const bio = fetchData(`/${artistId}/bio`).unwrap();

  return html`
    <section>
      <p class="bio">${bio}</p>
    </section>
  `;
});
