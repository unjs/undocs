import defu from 'defu'

export function genLanding(docsConfig) {
  if (docsConfig.landing === false) {
    return undefined
  }
  const landing = defu(docsConfig.landing || {}, {
    // Meta
    navigation: false,

    // Page
    title: docsConfig.name,
    description: docsConfig.description,

    // Hero
    heroTitle: docsConfig.name,
    heroSubtitle: docsConfig.shortDescription,
    heroDescription: docsConfig.description,
    heroLinks: {
      primary: {
        label: 'Get Started',
        icon: 'i-heroicons-rocket-launch',
        to: '/guide',
        order: 0,
      },
      github: {
        label: 'View on GitHub',
        icon: 'i-simple-icons-github',
        color: 'white',
        to: `https://github.com/${docsConfig.github}`,
        target: '_blank',
        order: 100,
      },
    },

    // Features
    featuresTitle: '',
    features: [],

    _github: docsConfig.github,
  })

  landing._heroMdTitle =
    landing._heroMdTitle || `[${landing.heroTitle}]{.text-primary} :br [${landing.heroSubtitle}]{.text-4xl}`

  return landing
}
