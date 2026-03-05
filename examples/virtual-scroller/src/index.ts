import {
  BrowserBackend,
  createComponent,
  type RenderContext,
  Repeat,
  Root,
  Runtime,
} from 'barebind';
import {
  ConsoleReporter,
  RuntimeProfiler,
} from 'barebind/addons/runtime-profiler';

import {
  VirtualScroller,
  type VirtualScrollerHandle,
} from './VirtualScroller.js';

interface AppProps {
  items: { height: number; label: string }[];
}

const App = createComponent(function App(
  { items }: AppProps,
  $: RenderContext,
): unknown {
  const [selectedIndex, setSelectedIndex] = $.useState(0);
  const virtualScrollerHandle = $.useRef<VirtualScrollerHandle | null>(null);

  const handleSelectedIndexChange = (event: Event) => {
    const index = Number(
      (event.target as HTMLSelectElement | HTMLInputElement).value,
    );
    virtualScrollerHandle.current!.scrollToIndex(index);
    setSelectedIndex(index);
  };

  const scroller = $.useMemo(
    () =>
      VirtualScroller({
        ref: virtualScrollerHandle,
        assumedItemHeight: 200,
        renderItem: ({ label, height }, _index, $) => $.html`
          <div :style=${{ lineHeight: height + 'px' }}>
            ${label} (${height}px)
          </div>
        `,
        items,
      }),
    [items],
  );

  return $.html`
    <header class="Header">
      <nav class="Header-nav">
        <select @change=${handleSelectedIndexChange}>
          <${Repeat({
            elementSelector: (item, index) => $.html`
              <option
                value=${index}
                selected=${index === selectedIndex}
              >
                ${item.label}
              </option>
            `,
            source: items,
          })}>
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

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(
  App({
    items: Array.from({ length: 1000 }, (_, index) => ({
      label: (index + 1).toString(),
      height: 200 + ((index % 10) - 5) * 20,
    })),
  }),
  document.body,
  runtime,
);

runtime.addObserver(new RuntimeProfiler(new ConsoleReporter()));

root.mount();
