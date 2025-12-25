import {
  BrowserBackend,
  createComponent,
  type RenderContext,
  Root,
  Runtime,
} from 'barebind';
import { ConsoleReporter, PerformanceProfiler } from 'barebind/addons/profiler';

import { VirtualScroller } from './VirtualScroller.js';

const App = createComponent(function App(
  _props: {},
  $: RenderContext,
): unknown {
  const scroller = VirtualScroller({
    assumedItemHeight: 200,
    getItemKey: (item) => item.key,
    renderItem: ({ height }, index, $) => {
      return $.html`
        <div :style=${{ lineHeight: height + 'px' }}>
          ${index + 1} (${height}px)
        </div>
      `;
    },
    source: Array.from({ length: 1000 }, (_, index) => ({
      key: index,
      height: 200 + ((index % 10) - 5) * 20,
    })),
  });

  return $.html`
    <div class="container">
      <h1>VirtualScroller</h1>
      <${scroller}>
    </div>
  `;
});

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(App({}), document.body, runtime);

runtime.addObserver(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
