import { LRUCache } from "lru-cache"

type Options = {
  uniqueTokenPerInterval?: number
  interval?: number
}

export function rateLimit(options: Options = {}) {
  const tokenCache = new LRUCache({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000,
  })

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0]
        if (tokenCount[0] === 0) {
          tokenCache.set(token, [1])
        } else {
          tokenCount[0] += 1
          tokenCache.set(token, tokenCount)
        }

        const currentUsage = tokenCount[0]

        if (currentUsage > limit) {
          return reject(new Error("Rate limit exceeded"))
        }

        return resolve()
      }),
  }
}
