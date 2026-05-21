import { TaskItem } from '@tiptap/extension-task-item'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { TaskItemView } from '../../ui/TaskItemView'

/**
 * Extends the built-in TaskItem with a React NodeView so that the checkbox
 * is rendered entirely by React (inline styles), bypassing all CSS specificity
 * and browser-default appearance issues.
 */
export const CustomTaskItem = TaskItem.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TaskItemView, { as: 'li' })
  },
})
