import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import {
  Either,
  type State,
  classMap,
  component,
} from '@emonkak/ebit/directives.js';

import { TodoInput } from './TodoInput.js';
import { type Todo, TodoState } from './state.js';

export interface TodoItemProps {
  todo$: State<Todo>;
}

export function TodoItem(
  { todo$ }: TodoItemProps,
  context: RenderContext,
): TemplateResult {
  const [isEditing, setIsEditing] = context.useState(false);
  const state = context.use(TodoState);
  const todo = context.use(todo$);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleEndEditing = () => {
    setIsEditing(false);
  };

  const handleUpdate = (title: string) => {
    if (title.length === 0) {
      state.removeTodo(todo.id);
    } else {
      state.updateTodo(todo.id, title);
    }
    setIsEditing(false);
  };

  const handleToggleItem = () => {
    state.toggleTodo(todo.id);
  };

  const handleRemoveItem = () => {
    state.removeTodo(todo.id);
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
