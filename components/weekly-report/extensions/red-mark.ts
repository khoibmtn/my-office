import { Mark, mergeAttributes } from '@tiptap/react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    red: {
      setRed: () => ReturnType
      toggleRed: () => ReturnType
      unsetRed: () => ReturnType
    }
  }
}

/**
 * Custom inline mark for red emphasis in weekly report rich sections.
 * Always renders red + bold so black-and-white printouts keep the visual emphasis.
 */
export const RedMark = Mark.create({
  name: 'red',

  parseHTML() {
    return [
      { tag: 'span[data-red-mark]' },
      {
        style: 'color',
        getAttrs: (value) => {
          if (typeof value !== 'string') return false
          const normalized = value.trim().toLowerCase()
          if (
            normalized === 'red' ||
            normalized === '#b91c1c' ||
            normalized === '#dc2626' ||
            normalized === 'rgb(185, 28, 28)' ||
            normalized === 'rgb(220, 38, 38)'
          ) {
            return {}
          }
          return false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-red-mark': 'true',
        class: 'text-red-700 font-bold',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setRed:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      toggleRed:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      unsetRed:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () => this.editor.commands.toggleMark(this.name),
    }
  },
})
