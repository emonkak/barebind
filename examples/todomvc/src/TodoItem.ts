import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import {
  type Atom,
  Either,
  classMap,
  component,
} from '@emonkak/ebit/directives.js';

import { TodoInput } from './TodoInput.js';
import { type Todo, TodoStore } from './store.js';

export interface TodoItemProps {
  todo$: Atom<Todo>;
}

export function TodoItem(
  { todo$ }: TodoItemProps,
  context: RenderContext,
): TemplateResult {
  const [isEditing, setIsEditing] = context.useState(false);
  const store = context.use(TodoStore);
  const todo = context.use(todo$);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleEndEditing = () => {
    setIsEditing(false);
  };

  const handleUpdate = (title: string) => {
    if (title.length === 0) {
      store.removeTodo(todo.id);
    } else {
      store.updateTodo(todo.id, title);
    }
    setIsEditing(false);
  };

  const handleToggleItem = () => {
    store.toggleTodo(todo.id);
  };

  const handleRemoveItem = () => {
    store.removeTodo(todo.id);
  };

  return context.html`
    <li
      class=${classMap({ completed: todo.completed })}
      data-testid="todo-item">
      <div class="view">
        <${
          isEditing
            ? Either.left(
                component(TodoInput, {
                  label: 'Edit Todo Input',
                  onSubmit: handleUpdate,
                  onBlur: handleEndEditing,
                  defaultValue: todo.title,
                }),
              )
            : Either.right(context.html`
              <input
                type="checkbox"
                class="toggle"
                data-testid="todo-item-toggle"
                .checked=${todo.completed}
                @change=${handleToggleItem}
              >
              <label
                data-testid="todo-item-label"
                @dblclick=${handleStartEditing}
              >
                ${todo.title}
              </label>
              <button
                type="button"
                class="destroy"
                data-testid="todo-item-button"
                @click=${handleRemoveItem}
              >
            `)
        }>
      </div>
    </li>
  `;
}
