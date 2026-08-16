import { useEffect, useState } from 'react'
import { getPhoto } from './repo'

/** Loads a stored photo blob and exposes it as an object URL, revoking it on cleanup. */
export function usePhotoUrl(photoId: number | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (photoId === undefined) {
      setUrl(undefined)
      return
    }

    let objectUrl: string | undefined
    let cancelled = false

    getPhoto(photoId).then((photo) => {
      if (cancelled || !photo) return
      objectUrl = URL.createObjectURL(photo.blob)
      setUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoId])

  return url
}
