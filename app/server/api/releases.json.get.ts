interface GithubRelease {
  id: number
  tag: string
  author: string
  name: string
  draft: boolean
  prerelease: boolean
  createdAt: string
  publishedAt: string
  markdown: string
  html: string
}

interface ReleaseResponse {
  releases: GithubRelease[]
}

export default defineEventHandler(async () => {
  const { docs } = useAppConfig()
  const github = docs?.github

  if (!github) {
    return []
  }

  const response = await $fetch<ReleaseResponse>(`https://ungh.cc/repos/${github}/releases`)

  return response?.releases ?? []
})
