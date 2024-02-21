import { defineGenerator, type Config } from 'automd'

export default <Config>{
  generators: {
    test: defineGenerator({
      name: 'test',
      async generate() {
        return {
          contents: `automd works!`,
        }
      },
    }),
  },
}
