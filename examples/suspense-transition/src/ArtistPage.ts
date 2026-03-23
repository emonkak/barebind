import { createComponent, html } from 'barebind';
import { Suspense } from 'barebind/addons/suspense';

import { Albums } from './Albums.js';
import { Biography } from './Biography.js';
import type { Artist } from './data.js';
import { Panel } from './Panel.js';

export interface ArtistPageProps {
  artist: Artist;
}

export const ArtistPage = createComponent<ArtistPageProps>(function ArtistPage({
  artist,
}) {
  return html`
    <h1>${artist.name}</h1>
    <${Biography({ artistId: artist.id })}>
    <${Suspense({
      fallback: AlbumsGlimmer({}),
      children: Panel({ children: Albums({ artistId: artist.id }) }),
    })}>
  `;
});

const AlbumsGlimmer = createComponent(function AlbumsGlimmer(_props) {
  return html`
    <div class="glimmer-panel">
      <div class="glimmer-line" />
      <div class="glimmer-line" />
      <div class="glimmer-line" />
    </div>
  `;
});
