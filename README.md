# Barebind

![CI Status](https://github.com/emonkak/barebind/actions/workflows/ci.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/emonkak/barebind/badge.svg)](https://coveralls.io/github/emonkak/barebind)

<img src="https://github.com/user-attachments/assets/6ec825af-eb75-476b-9800-99063df470c5" alt="Barebind—After the Magic" width="1024" height="1024">

No magic, no global state, no custom compiler—just bind data to native templates.

**Barebind** is a reactive UI library built on tagged templates (<code>html\`...\`</code>). Think React-like component model with hooks, lane-based scheduling, keyed list diffing, portals, and fragments, all without JSX or a custom compiler.

## Quick Start

```ts
import { DOMAdapter, DOMRoot, Runtime, createComponent, html } from 'barebind';

const Counter = createComponent(function Counter({ initialCount }) {
  const [count, setCount] = this.useState(initialCount);
  return html`
    <button @click=${() => { setCount((count) => count + 1) }}>
      ${count}
    </button>
  `;
});

const runtime = new Runtime(new DOMAdapter());
const root = new DOMRoot(document.body, runtime);
root.render(Counter({ initialCount: 100 }));
```
