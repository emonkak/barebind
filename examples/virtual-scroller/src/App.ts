import { createComponent, html } from 'barebind';
import {
  VirtualScroller,
  type VirtualScrollerHandle,
} from './VirtualScroller.js';

export interface AppProps {
  items: { height: number; label: string }[];
}

export const App = createComponent<AppProps>(function App({ items }) {
  const [selectedIndex, setSelectedIndex] = this.useState(0);
  const virtualScrollerHandle = this.useRef<VirtualScrollerHandle | null>(null);

  const handleSelectedIndexChange = (event: Event) => {
    const index = Number(
      (event.target as HTMLSelectElement | HTMLInputElement).value,
    );
    virtualScrollerHandle.current!.scrollToIndex(index);
    setSelectedIndex(index);
  };

  const scroller = this.useMemo(
    () =>
      VirtualScroller({
        ref: virtualScrollerHandle,
        assumedItemHeight: 200,
        renderItem: ({ label, height }, _index) => html`
          <div style=${{ lineHeight: height + 'px' }}>
            ${label} (${height}px)
          </div>
        `,
        items,
      }),
    [items],
  );

  return html`
    <header class="Header">
      <nav class="Header-nav">
        <select @change=${handleSelectedIndexChange}>
          <${items.map(
            (item, index) => html`
              <option
                value=${index}
                selected=${index === selectedIndex}
              >
                ${item.label}
              </option>
            `,
          )}>
        </select>
        <input
          type="range"
          min=${0}
          max=${items.length - 1}
          $value=${selectedIndex}
          @change=${handleSelectedIndexChange}
        >
      </nav>
    </header>
    <main class="Container">
      <h1>Virtual Scroller</h1>
      <${scroller}>
    </main>
  `;
});
