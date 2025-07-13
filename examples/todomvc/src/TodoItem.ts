import { type RenderContext, shallowEqual } from '@emonkak/ebit';
import { type Atom, component } from '@emonkak/ebit/extensions';

import { type Todo, TodoStore } from './store.js';
import { TodoInput } from './TodoInput.js';

export interface TodoItemProps {
  todo$: Atom<Todo>;
}

export function TodoItem(
  { todo$ }: TodoItemProps,
  context: RenderContext,
): unknown {
  const [isEditing, setIsEditing] = context.useState(false);
  const todoStore = context.use(TodoStore);
  const todo = context.use(todo$);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleEndEditing = () => {
    setIsEditing(false);
  };

  const handleUpdate = (title: string) => {
    if (title.length === 0) {
      todoStore.removeTodo(todo.id);
    } else {
      todoStore.updateTodo(todo.id, title);
    }
    setIsEditing(false);
  };

  const handleToggleItem = () => {
    todoStore.toggleTodo(todo.id);
  };

  const handleRemoveItem = () => {
    todoStore.removeTodo(todo.id);
  };

  return context.html`
    <li
      :classlist=${[{ completed: todo.completed }]}
      data-testid="todo-item">
      <div class="view">
        <${
          isEditing
            ? component(TodoInput, {
                label: 'Edit Todo Input',
                onSubmit: handleUpdate,
                onBlur: handleEndEditing,
                defaultValue: todo.title,
              })
            : context.html`
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
            `
        }>
      </div>
    </li>
  `;
}

TodoItem.shouldSkipUpdate = shallowEqual;
