import defu from 'defu'

export function genLanding(docsConfig) {
  const landing = defu(docsConfig.landing || {}, {
    navigation: false,
    title: docsConfig.name,
    description: docsConfig.description,
    hero: {
      title: docsConfig.name,
      description: docsConfig.description,
      text: '',
      links: {
        primary: {
          label: "Get Started",
          icon: "i-heroicons-rocket-launch",
          to: "/guide",
          size: "lg"
        },
        github: {
          label: "View on GitHub",
          icon: "i-simple-icons-github",
          color: "white",
          to: `https://github.com/${docsConfig.github}`,
          target: "_blank",
          size: "lg"
        },
      },
    },
    features: {}
  })

  landing.hero._title = landing.hero?._title|| `[${landing.hero?.title}]{.text-primary} :br [${landing.hero?.description}]{.text-4xl}`

  return landing
}
