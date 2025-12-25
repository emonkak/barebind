import {
  BrowserBackend,
  createComponent,
  type ElementRef,
  Keyed,
  type RenderContext,
  Repeat,
  Root,
  Runtime,
  shallowEqual,
} from 'barebind';
import { EventCallback } from 'barebind/addons/hooks';
import { ConsoleReporter, PerformanceProfiler } from 'barebind/addons/profiler';

export interface VirtualScrollerProps<T> {
  assumedItemHeight: number;
  getItemKey: (item: T, index: number) => unknown;
  offscreenRatio?: number;
  renderItem: (item: T, index: number, context: RenderContext) => unknown;
  source: T[];
}

interface Range {
  start: number;
  end: number;
}

interface MeasuredItem {
  key: unknown;
  height: number;
}

export const VirtualScroller = createComponent<VirtualScrollerProps<any>>(
  function VirtualScroller<T>(
    {
      assumedItemHeight,
      getItemKey,
      offscreenRatio = 1.5,
      renderItem,
      source,
    }: VirtualScrollerProps<T>,
    $: RenderContext,
  ): unknown {
    const [range, setRange] = $.useState<Range>({
      start: 0,
      end: 0,
    });
    const measuredItems = $.useMemo<MeasuredItem[]>(() => [], []);

    const getItemHeight = (item: T, index: number) => {
      const measuredItem = measuredItems[index];
      return measuredItem !== undefined &&
        Object.is(measuredItem.key, getItemKey(item, index))
        ? (measuredItem.height ?? assumedItemHeight)
        : assumedItemHeight;
    };

    const recomputeRangeFromBottom = (top: number, bottom: number) => {
      let end = source.length;
      let y = 0;

      // Skip tail items.
      for (let i = end - 1; i >= 0; i--) {
        const height = getItemHeight(source[i]!, i);
        if (y + height >= bottom) {
          break;
        }
        end = i;
        y += height;
      }

      let start = end;

      // Take head itmes.
      for (let i = start - 1; i >= 0; i--) {
        if (y > top) {
          break;
        }
        y += getItemHeight(source[i]!, i);
        start = i;
      }

      return {
        start,
        end,
      };
    };

    const recomputeRangeFromTop = (top: number, bottom: number) => {
      const size = source.length;
      let start = 0;
      let y = 0;

      // Skip head items.
      for (let i = (start = 0); i < size; i++) {
        const height = getItemHeight(source[i]!, i);
        if (y + height >= top) {
          break;
        }
        start = i + 1;
        y += height;
      }

      let end = start;

      // Take tail items.
      for (let i = end; i < size; i++) {
        if (y > bottom) {
          break;
        }
        y += getItemHeight(source[i]!, i);
        end = i + 1;
      }

      return {
        start,
        end,
      };
    };

    const intersectionObserverCallback = $.use(
      EventCallback((entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          switch (entry.target.localName) {
            // Spacer element:
            case 'div': {
              let range: Range;
              if (entry.target.previousSibling === null) {
                const top =
                  entry.intersectionRect.top - entry.boundingClientRect.top;
                const height = entry.rootBounds!.height;
                range = recomputeRangeFromTop(top, top + height);
              } else {
                const bottom =
                  entry.boundingClientRect.bottom -
                  entry.intersectionRect.bottom;
                const height = entry.rootBounds!.height;
                range = recomputeRangeFromBottom(bottom + height, bottom);
              }
              setRange(range, {
                areStatesEqual: shallowEqual,
              });
              break;
            }

            // Item element:
            case 'li': {
              const index = Number(entry.target.getAttribute('data-index')!);
              const item = source[index];

              if (item !== undefined) {
                const key = getItemKey(item, index);
                measuredItems[index] = {
                  key,
                  height: entry.boundingClientRect.height,
                };
              }
            }
          }
        }
      }),
    );

    const intersectionObserver = $.useMemo(
      () =>
        new IntersectionObserver(intersectionObserverCallback, {
          rootMargin: (offscreenRatio - 1) * 100 + '%',
        }),
      [],
    );

    $.useLayoutEffect(() => {
      for (let i = 0, l = source.length; i < l; i++) {
        const measuredItem = measuredItems[i];
        const key = getItemKey(source[i]!, i);

        if (measuredItem === undefined || !Object.is(measuredItem.key, key)) {
          measuredItems[i] = {
            key,
            height: assumedItemHeight,
          };
        }
      }

      if (measuredItems.length > source.length) {
        measuredItems.length = source.length;
      }
    }, [source]);

    const ref: ElementRef = (element: Element) => {
      intersectionObserver.observe(element);
      return () => {
        intersectionObserver.unobserve(element);
      };
    };

    const aboveSpace = source
      .slice(0, range.start)
      .map((item, offset) => getItemHeight(item, range.start + offset))
      .reduce((totalHeight, height) => totalHeight + height, 0);
    const belowSpace = source
      .slice(range.end)
      .map((item, offset) => getItemHeight(item, offset + range.end))
      .reduce((totalHeight, height) => totalHeight + height, 0);

    const aboveSpacer =
      range.start > 0
        ? $.html`
            <div
              :ref=${ref}
              :style=${{ height: aboveSpace + 'px' }}
              class="VirtualScroller-spacer"
            ></div>
          `
        : null;
    const belowSpacer =
      range.end < source.length
        ? $.html`
            <div
              :ref=${ref}
              :style=${{ height: belowSpace + 'px' }}
              class="VirtualScroller-spacer"
            ></div>
          `
        : null;

    return $.html`
      <div class="VirtualScroller">
        <${Keyed(range.start, aboveSpacer)}>
        <ul class="VirtualScroller-list">
          <${Repeat({
            source: source.slice(range.start, range.end),
            keySelector: getItemKey,
            valueSelector: (item, offset) => {
              const index = range.start + offset;
              return $.html`
                <li
                  :ref=${ref}
                  aria-posinset=${index + 1}
                  aria-setsize=${source.length}
                  class="VirtualScroller-item"
                  data-index=${index}
                >
                  <${renderItem(item, index, $)}>
                </li>
              `;
            },
          })}>
        </ul>
        <${Keyed(range.end, belowSpacer)}>
      </div>
    `;
  },
);

const App = createComponent(function App(_props: {}) {
  return VirtualScroller({
    renderItem: (item, _index, $) => {
      return $.html`
        <div :style=${{ lineHeight: 100 + 'px' }}>${item.label}</div>
      `;
    },
    assumedItemHeight: 100,
    getItemKey: (item) => item.key,
    source: Array.from({ length: 1000 }, (_, index) => ({
      label: index.toString(),
      key: index,
    })),
  });
});

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(App({}), document.body, runtime);

runtime.addObserver(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
