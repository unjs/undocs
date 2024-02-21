export default defineAppConfig({
  docs: {
    socialBackground: undefined,
    logo: '/icon.svg',
    github: undefined,
    socials: {
      x: undefined,
    },
  },
  ui: {
    icons: {
      dynamic: true,
    },
    content: {
      prose: {
        code: {
          icon: {
            auto: 'vscode-icons:file-type-js',
          },
        },
      },
    },
    presets: {
      button: {
        secondary: {
          size: 'md',
          color: 'gray',
          variant: 'ghost',
          ui: {
            font: 'font-semibold',
            color: { gray: { ghost: 'text-gray-950 hover:bg-primary/60 dark:text-gray-50 dark:hover:bg-primary/40' } },
            size: { md: 'text-base' },
          },
        },
      },
    },
    header: {
      button: {
        icon: {
          open: 'i-heroicons-bars-3-bottom-right',
        },
      },
    },
    button: {
      base: 'transition ease-in',
      color: {
        gray: {
          solid: 'shadow-none bg-gray-300/20 hover:bg-gray-300/40 dark:bg-gray-700/40 dark:hover:bg-gray-700/50',
        },
      },
    },
  },
})
