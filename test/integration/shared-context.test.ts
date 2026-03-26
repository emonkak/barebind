import { createComponent, html, SharedContext } from 'barebind';
import { expect, test } from 'vitest';
import { createTestRoot } from '../adapter.js';
import { stripComments } from '../helpers.js';

const App = createComponent(function App({}, $) {
  $.use(new ClockContext(new Date(Date.UTC(2000))));

  return Main({});
});

const Main = createComponent(function Main({}, $) {
  const clock = $.use(ClockContext);
  return html`<p>Current time is ${clock.date.toISOString()}</p>`;
});

class ClockContext extends SharedContext {
  readonly date: Date;

  constructor(date: Date) {
    super();
    this.date = date;
  }
}

test('renders a value provided by the shared context', async () => {
  const container = document.createElement('div');
  const root = createTestRoot(App({}), container);

  await root.mount().finished;

  expect(stripComments(container).innerHTML).toBe(
    '<p>Current time is 2000-01-01T00:00:00.000Z</p>',
  );

  await root.unmount().finished;

  expect(container.innerHTML).toBe('');
});

test('throws an error when the shared context is not provided', async () => {
  const container = document.createElement('div');
  const root = createTestRoot(Main({}), container);

  await expect(root.mount().finished).rejects.toThrow(
    expect.objectContaining({
      cause: expect.objectContaining({
        message: expect.stringContaining('No ClockContext found.'),
      }),
    }),
  );
});
