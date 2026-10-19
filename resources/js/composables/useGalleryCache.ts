import { appDb } from '@/db/app.db'
import type { GalleryIndex, GalleryPhoto } from '@/services/gallery.api'

/**
 * Offline-кеш галереи и шапки профиля в IndexedDB.
 *
 * Паттерн тот же, что у чата: мгновенный рендер кеша → фоновая
 * ревалидация → точечный пересчёт. Свои мутации (upload/replace/remove/
 * makeMain/лайк) пишут в кеш сразу (оптимистика), чужие изменения
 * подтягиваются ревалидацией при открытии + событием `user:gallery.changed`
 * в realtime-bus (сокет `gallery.changed` и polling-версия тика
 * зеркалятся в одно событие — см. useRealtimePoller).
 *
 * @example
 * const cached = await loadCachedGallery(uid, ownerId)
 * if (cached) applyIndex(cached)
 * const fresh = await galleryApi.list(ownerId)
 * await saveGallery(uid, ownerId, fresh)
 */
function galleryKey(uid: number, ownerId: number): string {
  return `${uid}:${ownerId}`
}

function profileKey(uid: number, ownerId: number): string {
  return `${uid}:${ownerId}`
}

/**
 * Прочитать кешированную галерею.
 *
 * @param uid id смотрящего (владелец кеша)
 * @param ownerId id владельца галереи
 * @returns GalleryIndex или null
 */
export async function loadCachedGallery(uid: number, ownerId: number): Promise<GalleryIndex | null> {
  if (!(uid > 0) || !(ownerId > 0)) {
    return null
  }
  try {
    const row = await appDb.galleries.get(galleryKey(uid, ownerId))
    if (!row) {
      return null
    }
    try {
      return JSON.parse(row.value) as GalleryIndex
    } catch {
      return null
    }
  } catch {
    return null
  }
}

/**
 * Сохранить галерею целиком (после list с сервера).
 *
 * @param uid id смотрящего
 * @param ownerId id владельца галереи
 * @param index ответ galleryApi.list
 */
export async function saveGallery(uid: number, ownerId: number, index: GalleryIndex): Promise<void> {
  if (!(uid > 0) || !(ownerId > 0) || !index) {
    return
  }
  try {
    await appDb.galleries.put({
      key: galleryKey(uid, ownerId),
      uid,
      ownerId,
      updatedAt: Date.now(),
      value: JSON.stringify(index),
    })
  } catch {}
}

/**
 * Точечно обновить одно фото в кеше (лайк, подпись, замена, makeMain).
 *
 * @param uid id смотрящего
 * @param ownerId id владельца галереи
 * @param photo свежее фото с сервера
 */
export async function patchCachedPhoto(uid: number, ownerId: number, photo: GalleryPhoto): Promise<void> {
  const id = Number(photo?.id)
  if (!(uid > 0) || !(ownerId > 0) || !(id > 0)) {
    return
  }
  try {
    const row = await appDb.galleries.get(galleryKey(uid, ownerId))
    if (!row) {
      return
    }
    let index: GalleryIndex | null = null
    try {
      index = JSON.parse(row.value) as GalleryIndex
    } catch {
      return
    }
    if (!index || !Array.isArray(index.photos)) {
      return
    }
    const photos = [...index.photos]
    const at = photos.findIndex((item) => Number(item?.id) === id)
    if (at === -1) {
      photos.unshift(photo)
    } else {
      photos[at] = { ...photos[at], ...photo }
    }
    if (photo.is_main) {
      for (const item of photos) {
        item.is_main = Number(item.id) === id
      }
      photos.sort((a, b) => Number(b.is_main ?? false) - Number(a.is_main ?? false))
    }
    await appDb.galleries.put({
      key: row.key,
      uid,
      ownerId,
      updatedAt: Date.now(),
      value: JSON.stringify({ ...index, photos, count: photos.length }),
    })
  } catch {}
}

/**
 * Точечно удалить фото из кеша.
 *
 * @param uid id смотрящего
 * @param ownerId id владельца галереи
 * @param photoId id фото
 */
export async function removeCachedPhoto(uid: number, ownerId: number, photoId: number): Promise<void> {
  const id = Number(photoId)
  if (!(uid > 0) || !(ownerId > 0) || !(id > 0)) {
    return
  }
  try {
    const row = await appDb.galleries.get(galleryKey(uid, ownerId))
    if (!row) {
      return
    }
    let index: GalleryIndex | null = null
    try {
      index = JSON.parse(row.value) as GalleryIndex
    } catch {
      return
    }
    if (!index || !Array.isArray(index.photos)) {
      return
    }
    const photos = index.photos.filter((item) => Number(item?.id) !== id)
    await appDb.galleries.put({
      key: row.key,
      uid,
      ownerId,
      updatedAt: Date.now(),
      value: JSON.stringify({ ...index, photos, count: photos.length }),
    })
  } catch {}
}

/**
 * Прочитать кешированный снапшот шапки профиля.
 *
 * @param uid id смотрящего
 * @param ownerId id владельца профиля
 * @returns минимальный набор полей шапки или null
 */
export async function loadCachedProfile(uid: number, ownerId: number): Promise<Record<string, unknown> | null> {
  if (!(uid > 0) || !(ownerId > 0)) {
    return null
  }
  try {
    const row = await appDb.profileHeaders.get(profileKey(uid, ownerId))
    if (!row) {
      return null
    }
    try {
      return JSON.parse(row.value) as Record<string, unknown>
    } catch {
      return null
    }
  } catch {
    return null
  }
}

/**
 * Сохранить снапшот шапки профиля (аватар, имя, счётчики).
 *
 * @param uid id смотрящего
 * @param ownerId id владельца профиля
 * @param snapshot минимальный набор полей шапки
 */
export async function saveProfileSnapshot(uid: number, ownerId: number, snapshot: Record<string, unknown>): Promise<void> {
  if (!(uid > 0) || !(ownerId > 0) || !snapshot) {
    return
  }
  try {
    await appDb.profileHeaders.put({
      key: profileKey(uid, ownerId),
      uid,
      ownerId,
      updatedAt: Date.now(),
      value: JSON.stringify(snapshot),
    })
  } catch {}
}

/**
 * Полностью снести галерейный кеш аккаунта (логаут/смена юзера).
 *
 * @param uid id пользователя
 */
export async function clearGalleryCache(uid: number): Promise<void> {
  if (!(uid > 0)) {
    return
  }
  try {
    await appDb.galleries.where('uid').equals(uid).delete()
  } catch {}
  try {
    await appDb.profileHeaders.where('uid').equals(uid).delete()
  } catch {}
}

/**
 * Снести кеш галереи конкретного владельца (чужие изменения).
 *
 * Нужен realtime-инвалидации: когда у просматриваемого пользователя
 * меняется фото, закешированная галерея гарантированно протухла, и
 * следующее открытие не должно показать старое.
 *
 * @param uid id смотрящего (владелец кеша)
 * @param ownerId id владельца галереи
 */
export async function invalidateCachedGallery(uid: number, ownerId: number): Promise<void> {
  if (!(uid > 0) || !(ownerId > 0)) {
    return
  }
  try {
    await appDb.galleries.delete(galleryKey(uid, ownerId))
  } catch {}
}

/**
 * Снести кеш шапки профиля конкретного владельца (смена аватара/имени).
 *
 * @param uid id смотрящего
 * @param ownerId id владельца профиля
 */
export async function invalidateCachedProfile(uid: number, ownerId: number): Promise<void> {
  if (!(uid > 0) || !(ownerId > 0)) {
    return
  }
  try {
    await appDb.profileHeaders.delete(profileKey(uid, ownerId))
  } catch {}
}
