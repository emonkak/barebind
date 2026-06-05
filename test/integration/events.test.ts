import { DOMAdapter, html, Root, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('events', () => {
  let container: Element;
  let runtime: Runtime;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    runtime = new Runtime(new DOMAdapter());
    root = new Root(container, runtime);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('fires event listeners when the event occurs', async () => {
    const events: Partial<Event>[] = [];
    const template = html`
      <button
        id="target"
        @click=${(event: Event) => {
          events.push(snapshot(event));
        }}></button>
    `;

    await root.render(template).finished;
    const target = container.querySelector<HTMLButtonElement>('#target')!;
    target.click();

    expect(events).toHaveLength(1);
    expect(events[0]).toStrictEqual(
      expect.objectContaining({
        currentTarget: target,
        target,
        eventPhase: Event.AT_TARGET,
      }),
    );
  });

  it('fires event listener objects when the event occurs', async () => {
    const events: Partial<Event>[] = [];
    const template = html`
      <button
        id="outer"
        @click=${{
          handleEvent(event: Event) {
            events.push(snapshot(event));
          },
        }}>
        <span id="inner"></span>
      </button>
    `;

    await root.render(template).finished;
    const outer = container.querySelector<HTMLButtonElement>('#outer')!;
    const inner = container.querySelector<HTMLSpanElement>('#inner')!;
    inner.click();

    expect(events).toHaveLength(1);
    expect(events[0]).toStrictEqual(
      expect.objectContaining({
        currentTarget: outer,
        eventPhase: Event.BUBBLING_PHASE,
        target: inner,
      }),
    );
  });

  it('fires event listener objects in the capture phase when the event occurs', async () => {
    const events: Partial<Event>[] = [];
    const template = html`
      <button
        id="outer"
        @click=${{
          capture: true,
          handleEvent(event: Event) {
            events.push(snapshot(event));
          },
        }}>
        <span id="inner"></span>
      </button>
    `;

    await root.render(template).finished;
    const outer = container.querySelector<HTMLButtonElement>('#outer')!;
    const inner = container.querySelector<HTMLSpanElement>('#inner')!;
    inner.click();

    expect(events).toHaveLength(1);
    expect(events[0]).toStrictEqual(
      expect.objectContaining({
        currentTarget: outer,
        eventPhase: Event.CAPTURING_PHASE,
        target: inner,
      }),
    );
  });

  it('throws when an invalid value is used as an event listener', async () => {
    const template = html`
      <button id="target" @click=${123}></button>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Event values must be an EventListener, EventListenerObject, null or undefined.',
    );
  });

  it.each([
    null,
    undefined,
  ])('removes the event listener when the value is %s', async (value) => {
    const listener = vi.fn();
    const render = (listener: unknown) => html`
      <button id="target" @click=${listener}></button>
    `;

    await root.render(render(listener)).finished;
    const target = container.querySelector<HTMLButtonElement>('#target')!;
    target.click();
    expect(listener).toHaveBeenCalledOnce();

    await root.render(render(value)).finished;
    target.click();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('invokes the new function listener when the listener is updated', async () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const render = (listener: (e: Event) => void) => html`
      <button id="target" @click=${listener}></button>
    `;

    await root.render(render(listener1)).finished;
    const target = container.querySelector<HTMLButtonElement>('#target')!;
    target.click();
    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).not.toHaveBeenCalledOnce();

    await root.render(render(listener2)).finished;
    target.click();
    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('re-attaches the object listener when the options change', async () => {
    const events: Partial<Event>[] = [];
    const render = (listener: Record<string, unknown>) => html`
      <button
        id="outer"
        @click=${listener}
      >
        <span id="inner"></span>
      </button>
    `;

    await root.render(
      render({
        handleEvent(event: Event) {
          events.push(snapshot(event));
        },
      }),
    ).finished;
    const outer = container.querySelector<HTMLButtonElement>('#outer')!;
    const inner = container.querySelector<HTMLSpanElement>('#inner')!;
    inner.click();

    expect(events).toHaveLength(1);
    expect(events[0]).toStrictEqual(
      expect.objectContaining({
        currentTarget: outer,
        eventPhase: Event.BUBBLING_PHASE,
        target: inner,
      }),
    );

    await root.render(
      render({
        capture: true,
        handleEvent(event: Event) {
          events.push(snapshot(event));
        },
      }),
    ).finished;
    inner.click();

    expect(events).toHaveLength(2);
    expect(events[1]).toStrictEqual(
      expect.objectContaining({
        currentTarget: outer,
        eventPhase: Event.CAPTURING_PHASE,
        target: inner,
      }),
    );
  });
});

function snapshot<T extends object>(source: T): Partial<T> {
  const snapshot: Partial<T> = {};
  for (const key in source) {
    snapshot[key] = source[key];
  }
  return snapshot;
}
