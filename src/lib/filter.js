export const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'other', label: 'Other' },
];

export function matchesTypeFilter(file, filter = 'all') {
  if (filter === 'all') return true;
  if (!file || typeof file.type !== 'string') return false;
  if (file.type === 'folder') return false;
  if (filter === 'other') return !['image', 'video', 'pdf'].includes(file.type);
  return file.type === filter;
}

export function filterCloudFiles(items = [], options = {}) {
  const {
    active = 'My Cloud',
    currentFolder = null,
    query = '',
    typeFilter = 'all',
  } = options;
  const term = String(query ?? '').trim().toLowerCase();

  return items.filter(file => {
    if (!file || typeof file.name !== 'string') return false;
    if (active === 'Trash' && !file.trashed) return false;
    if (active !== 'Trash' && file.trashed) return false;
    if (active === 'Starred' && !file.starred) return false;
    if (active === 'Photos' && !['image', 'video'].includes(file.type)) return false;
    if (active === 'My Cloud' && currentFolder && (file.type === 'folder' ? file.parentId !== currentFolder.id : file.folderId !== currentFolder.id)) return false;
    if (active === 'My Cloud' && !currentFolder && (file.type !== 'folder' || file.parentId)) return false;
    if (!matchesTypeFilter(file, typeFilter)) return false;
    return file.name.toLowerCase().includes(term);
  });
}
