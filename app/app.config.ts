export default defineAppConfig({
  site: {
    url: 'https://packageName.unjs.io',
    name: 'packageName',
    description: 'packageDescription',
  },
  docs: {
    github: '',
    logo: '/icon.svg',
    socialBackground: 'http://unjs.io/assets/header/ellipse.png',
    socials: {
      github: 'unjs',
      x: 'unjsio'
    },
    footer: {
      menu: [
        // {
        //   title: 'Community',
        //   items: [
        //     {
        //       title: 'Contribute',
        //       url: 'https://github.com/unjs/governance',
        //       target: '_blank',
        //     },
        //     {
        //       title: 'Contact us',
        //       url: 'mailto:hi@unjs.io',
        //       rel: null,
        //       target: null,
        //     },
        //   ],
        // },
        // {
        //   title: 'UnJS',
        //   items: [
        //     {
        //       title: 'Website',
        //       url: 'https://unjs.io',
        //       rel: 'noopener',
        //     },
        //     {
        //       title: 'GitHub',
        //       url: 'https://github.com/unjs',
        //       target: '_blank',
        //     },
        //   ],
        // },
      ],
    },
  },
  ui: {
    primary: 'theme',
    gray: 'cool',
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
