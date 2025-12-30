import {
  type Component,
  createComponent,
  Keyed,
  type Ref,
  type RenderContext,
  Repeat,
} from 'barebind';
import { EventCallback, ImperativeHandle } from 'barebind/addons/hooks';

export interface VirtualScroller extends Component<VirtualScrollerProps<any>> {
  <T>(props: VirtualScrollerProps<T>): unknown;
}

export interface VirtualScrollerProps<T> {
  assumedItemHeight: number;
  delay?: number;
  getItemKey?: (item: T, index: number) => unknown;
  initialItemIndex?: number;
  offscreenRatio?: number;
  ref?: Ref<VirtualScrollerHandle>;
  renderItem: (item: T, index: number, context: RenderContext) => unknown;
  scrollMargin?: string;
  source: T[];
}

export interface VirtualScrollerHandle {
  getMeasuredItems(): MeasuredItem[];
  getVisibleElements(): Element[];
  getVisibleRange(): Range;
  scrollToIndex(index: number): void;
}

export interface MeasuredItem {
  key: unknown;
  height: number;
}

// A (half-open) range bounded inclusively below and exclusively above.
export interface Range {
  start: number;
  end: number;
}

export const VirtualScroller: VirtualScroller = createComponent(
  function VirtualScroller<T>(
    {
      assumedItemHeight,
      getItemKey = (_item, index) => index,
      delay,
      scrollMargin,
      initialItemIndex = 0,
      offscreenRatio = 1,
      ref = null,
      renderItem,
      source,
    }: VirtualScrollerProps<T>,
    $: RenderContext,
  ): unknown {
    const [visibleRange, setVisibleRange] = $.useState<Range>({
      start: initialItemIndex,
      end: Math.min(initialItemIndex + 1, source.length),
    });
    const measuredItems = $.useMemo<MeasuredItem[]>(() => [], []);
    const visibleElements = $.useMemo<Map<number, Element>>(
      () => new Map(),
      [],
    );

    const getItemHeight = (item: T, index: number): number => {
      const measuredItem = measuredItems[index];
      return measuredItem !== undefined &&
        Object.is(measuredItem.key, getItemKey(item, index))
        ? measuredItem.height
        : assumedItemHeight;
    };

    const computeRangeHeight = (
      start: number,
      end: number = source.length,
    ): number => {
      let height = 0;
      for (let i = start; i < end; i++) {
        height += getItemHeight(source[i]!, i);
      }
      return height;
    };

    const computeVisibleRange = (top: number, bottom: number): Range => {
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
          switch (entry.target.className) {
            case 'VirtualScroller-spacer': {
              if (!entry.isIntersecting && !entry.target.isConnected) {
                continue;
              }

              const top =
                -entry.target.parentElement!.getBoundingClientRect().top +
                entry.rootBounds!.top;
              const bottom = top + entry.rootBounds!.height;
              const visibleRange = computeVisibleRange(top, bottom);
              setVisibleRange(visibleRange, {
                areStatesEqual: areRangesEqual,
              });
              break;
            }

            case 'VirtualScroller-item': {
              if (!entry.target.isConnected) {
                continue;
              }

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
          delay,
        } as IntersectionObserverInit & { delay?: number }),
      [],
    );

    const spacerRef = $.useCallback((element: Element) => {
      intersectionObserver.observe(element);
      return () => {
        intersectionObserver.unobserve(element);
      };
    }, []);
    const itemRef = $.useCallback((element: Element) => {
      const index = Number(element.getAttribute('aria-posinset')) - 1;
      visibleElements.set(index, element);
      intersectionObserver.observe(element);
      return () => {
        intersectionObserver.unobserve(element);
        visibleElements.delete(index);
      };
    }, []);

    $.use(
      ImperativeHandle(ref, () => ({
        getMeasuredItems(): MeasuredItem[] {
          return measuredItems.slice();
        },
        getVisibleElements(): Element[] {
          return visibleElements
            .entries()
            .toArray()
            .sort((x, y) => x[0] - y[0])
            .map((x) => x[1]);
        },
        getVisibleRange(): Range {
          return structuredClone(visibleRange);
        },
        async scrollToIndex(
          index: number,
          options?: ScrollIntoViewOptions,
        ): Promise<void> {
          if (!withinRange(visibleRange, index)) {
            intersectionObserver.disconnect();
            await setVisibleRange({ start: index, end: index + 1 }).finished;
          }
          visibleElements.get(index)?.scrollIntoView(options);
        },
      })),
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

      measuredItems.length = source.length;
    }, [source]);

    const aboveSpace = computeRangeHeight(0, visibleRange.start);
    const belowSpace = computeRangeHeight(visibleRange.end);

    const aboveSpacer =
      aboveSpace > 0
        ? $.html`
            <div
              class="VirtualScroller-spacer"
              :ref=${spacerRef}
              :style=${{ height: aboveSpace + 'px' }}
            ></div>
          `
        : null;
    const belowSpacer =
      belowSpace > 0
        ? $.html`
            <div
              class="VirtualScroller-spacer"
              :ref=${spacerRef}
              :style=${{ height: belowSpace + 'px' }}
            ></div>
          `
        : null;

    return $.html`
      <div class="VirtualScroller">
        <${Keyed(aboveSpace, aboveSpacer)}>
        <ul class="VirtualScroller-list" :style=${{ scrollMargin }}>
          <${Repeat({
            source: source.slice(visibleRange.start, visibleRange.end),
            keySelector: (item, offset) =>
              getItemKey(item, visibleRange.start + offset),
            valueSelector: (item, offset) => {
              const index = visibleRange.start + offset;
              return $.html`
                <li
                  aria-posinset=${index + 1}
                  aria-setsize=${source.length}
                  class="VirtualScroller-item"
                  :ref=${itemRef}
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

function withinRange(range: Range, index: number): boolean {
  return range.start <= index && index < range.end;
}
