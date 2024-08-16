import { ConcurrentUpdater, UpdateHost } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { ItemState, StoryState, UserState } from './state.js';

const host = new UpdateHost();
const updater = new ConcurrentUpdater();

host.mount(
  component(App, {
    storyState: new StoryState(),
    itemState: new ItemState(),
    userState: new UserState(),
  }),
  document.body,
  updater,
);
