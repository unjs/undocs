import { resolve, join } from 'node:path'
import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

// eslint-disable-next-line unicorn/prefer-module
const uiProDir = resolve(require.resolve('@nuxt/ui-pro'), '..')

// eslint-disable-next-line unicorn/prefer-module
const appDir = __dirname

const contentFiles = [
  join(appDir, '{components,pages,layouts}/**/*.{vue,mjs,js,cjs,ts}'),
  join(appDir, '.unjs/{components,pages,layouts}/**/*.{vue,mjs,js,cjs,ts}'),
  join(uiProDir, 'components/**/*.{vue,mjs,js,cjs,ts}'),
  join(uiProDir, 'modules/pro/runtime/components/**/*.{vue,mjs,js,cjs,ts}'),
]

export default <Partial<Config>>{
  content: {
    files: contentFiles,
    transform: {},
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['nunito', 'sans-serif', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        yellow: {
          50: '#FEFDF7',
          100: '#FDFCEF',
          200: '#FAF6D6',
          300: '#F7F1BD',
          400: '#F2E78C',
          500: '#ECDC5A',
          600: '#D4C651',
          700: '#8E8436',
          800: '#6A6329',
          900: '#47421B',
          950: '#2F2C12',
        },
      },
    },
  },
}
