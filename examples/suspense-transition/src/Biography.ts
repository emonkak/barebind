import { createComponent } from 'barebind';
import { Resource } from 'barebind/addons/suspense';
import { fetchBio } from './data.js';

export interface BiographyProps {
  artistId: string;
}

export const Biography = createComponent<BiographyProps>(function Biography(
  { artistId },
  $,
) {
  const bio = $.use(Resource(() => fetchBio(artistId)));

  return $.html`
    <section>
      <p class="bio">${bio.unwrap()}</p>
    </section>
  `;
});
