import {
  type Component,
  createComponent,
  Keyed,
  type Ref,
  type RenderContext,
  Repeat,
} from 'barebind';
import { EventCallback } from 'barebind/addons/hooks';

export interface VirtualScroller extends Component<VirtualScrollerProps<any>> {
  <T>(props: VirtualScrollerProps<T>): unknown;
}

export interface VirtualScrollerProps<T> {
  assumedItemHeight: number;
  getItemKey: (item: T, index: number) => unknown;
  offscreenRatio?: number;
  renderItem: (item: T, index: number, context: RenderContext) => unknown;
  source: T[];
}

interface MeasuredItem {
  key: unknown;
  height: number;
}

interface Range {
  start: number;
  end: number;
}

export const VirtualScroller: VirtualScroller = createComponent(
  function VirtualScroller<T>(
    {
      assumedItemHeight,
      getItemKey,
      offscreenRatio = 1,
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
        ? measuredItem.height
        : assumedItemHeight;
    };

    const recomputeRange = (top: number, bottom: number) => {
      const size = source.length;
      let start = 0;
      let y = 0;

      // Skip head items.
      for (let i = start; i < size; i++) {
        const height = getItemHeight(source[i]!, i);
        if (y + height >= top) {
          break;
        }
        start = i + 1;
        y += height;
      }

      let end = start;

      // Take tail items.
      for (let i = start; i < size; i++) {
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

          switch (entry.target.className) {
            case 'VirtualScroller-spacer': {
              const top =
                -entry.target.parentElement!.getBoundingClientRect().top +
                entry.rootBounds!.top;
              const bottom = top + entry.rootBounds!.height;
              const range = recomputeRange(top, bottom);
              setRange(range, {
                areStatesEqual: areRangesEqual,
              });
              break;
            }

            case 'VirtualScroller-item': {
              const index =
                Number(entry.target.getAttribute('aria-posinset')!) - 1;
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
          rootMargin: offscreenRatio * 100 + '%',
        }),
      [],
    );

    const ref = $.useCallback((element: Element) => {
      intersectionObserver.observe(element);
      return () => {
        intersectionObserver.unobserve(element);
      };
    }, []);

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

      measuredItems.length = source.length;
    }, [source]);

    const aboveSpace = source
      .slice(0, range.start)
      .map((item, index) => getItemHeight(item, index))
      .reduce((totalHeight, height) => totalHeight + height, 0);
    const belowSpace = source
      .slice(range.end)
      .map((item, offset) => getItemHeight(item, range.end + offset))
      .reduce((totalHeight, height) => totalHeight + height, 0);

    const aboveSpacer =
      aboveSpace > 0
        ? $.html`
            <div
              :ref=${ref}
              :style=${{ height: aboveSpace + 'px' }}
              class="VirtualScroller-spacer"
            ></div>
          `
        : null;
    const belowSpacer =
      belowSpace > 0
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
        <${Keyed(aboveSpace, aboveSpacer)}>
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
                >
                  <${renderItem(item, index, $)}>
                </li>
              `;
            },
          })}>
        </ul>
        <${Keyed(belowSpace, belowSpacer)}>
      </div>
    `;
  },
);

function areRangesEqual(x: Range, y: Range) {
  return x.start === y.start && x.end === y.end;
}
