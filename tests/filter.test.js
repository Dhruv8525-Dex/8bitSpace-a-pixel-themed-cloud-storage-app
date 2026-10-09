import { describe, expect, it } from 'vitest'
import { TYPE_FILTERS, filterCloudFiles, matchesTypeFilter } from '../src/lib/filter.js'

const sampleFiles = [
  { id: 'root-folder', name: 'Root', type: 'folder', parentId: null },
  { id: 'nested-folder', name: 'Archive', type: 'folder', parentId: 'root-folder' },
  { id: 'img-1', name: 'Sunset.png', type: 'image', folderId: 'root-folder', trashed: false, starred: false },
  { id: 'img-2', name: 'Moon.png', type: 'image', folderId: 'nested-folder', trashed: false, starred: false },
  { id: 'pdf-1', name: 'Favorite.pdf', type: 'pdf', folderId: 'root-folder', trashed: false, starred: true },
  { id: 'text-1', name: 'Readme.txt', type: 'text', folderId: 'root-folder', trashed: false, starred: false },
  { id: 'trash-1', name: 'Old.png', type: 'image', folderId: 'root-folder', trashed: true, starred: false },
]

describe('cloud file filtering', () => {
  it('tracks the visible type filters and keeps folders out of file-only views', () => {
    expect(TYPE_FILTERS.map(({ id }) => id)).toEqual(['all', 'image', 'video', 'pdf', 'other'])
    expect(matchesTypeFilter({ type: 'folder' }, 'image')).toBe(false)
    expect(matchesTypeFilter({ type: 'text' }, 'other')).toBe(true)
    expect(matchesTypeFilter({ type: 'pdf' }, 'pdf')).toBe(true)
  })

  it('shows only root folders at the cloud root', () => {
    const result = filterCloudFiles(sampleFiles, { active: 'My Cloud', currentFolder: null, query: '', typeFilter: 'all' })

    expect(result.map(file => file.id)).toEqual(['root-folder'])
  })

  it('applies active panels, type filters and search text together', () => {
    const photos = filterCloudFiles(sampleFiles, { active: 'Photos', currentFolder: null, query: 'sun', typeFilter: 'all' })
    expect(photos.map(file => file.name)).toEqual(['Sunset.png'])

    const trash = filterCloudFiles(sampleFiles, { active: 'Trash', currentFolder: null, query: 'old', typeFilter: 'all' })
    expect(trash.map(file => file.name)).toEqual(['Old.png'])

    const nestedOther = filterCloudFiles(sampleFiles, { active: 'My Cloud', currentFolder: { id: 'root-folder' }, query: '', typeFilter: 'other' })
    expect(nestedOther.map(file => file.name)).toEqual(['Readme.txt'])
  })
})
