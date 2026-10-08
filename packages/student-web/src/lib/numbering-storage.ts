/** Copy once, without deleting the legacy backup or resurrecting a cleared new card. */
export function migrateRetrievalStorage(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  const marker = 'systemedu:molecule:numbering-v2:retrieval-copied'
  const current = 'systemedu:molecule:M07:retrieval:v1'
  if (storage.getItem(marker)) return
  const previous = storage.getItem('systemedu:molecule:M23:retrieval:v1')
  if (storage.getItem(current) === null && previous !== null) storage.setItem(current, previous)
  storage.setItem(marker, '1')
}
