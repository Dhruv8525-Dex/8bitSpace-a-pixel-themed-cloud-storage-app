import { test, expect } from '@playwright/test'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const origin = 'https://sajbwbtqlassnipnbdkk.supabase.co'
const folderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const subfolderId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const folder = {
  id: folderId,
  user_id: id,
  parent_id: null,
  name: 'Sort Test',
  updated_at: new Date('2026-06-01T10:00:00Z').toISOString(),
  is_starred: false,
  trashed_at: null,
}
const subfolder = {
  id: subfolderId,
  user_id: id,
  parent_id: folderId,
  name: 'archive',
  updated_at: new Date('2026-05-01T10:00:00Z').toISOString(),
  is_starred: false,
  trashed_at: null,
}
// Names and dates are deliberately in different orders, so switching the sort
// visibly changes the list. Modified order: zebra, archive, mango, apple.
// Name order: apple, archive, mango, zebra.
const files = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: id,
    folder_id: folderId,
    name: 'zebra.txt',
    mime_type: 'text/plain',
    size_bytes: 10,
    storage_path: 'space-files/zebra.txt',
    updated_at: new Date('2026-06-15T10:00:00Z').toISOString(),
    is_starred: false,
    trashed_at: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: id,
    folder_id: folderId,
    name: 'apple.txt',
    mime_type: 'text/plain',
    size_bytes: 20,
    storage_path: 'space-files/apple.txt',
    updated_at: new Date('2026-01-10T10:00:00Z').toISOString(),
    is_starred: false,
    trashed_at: null,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    user_id: id,
    folder_id: folderId,
    name: 'mango.txt',
    mime_type: 'text/plain',
    size_bytes: 30,
    storage_path: 'space-files/mango.txt',
    updated_at: new Date('2026-03-20T10:00:00Z').toISOString(),
    is_starred: false,
    trashed_at: null,
  },
]

async function signedIn(page) {
  const user = {
    id,
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    identities: [],
  }
  await page.addInitScript(({ user, origin }) => {
    const now = Math.floor(Date.now() / 1000)
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const claims = { sub: user.id, iss: `${origin}/auth/v1`, aud: 'authenticated', role: 'authenticated', is_anonymous: false, exp: now + 3600, iat: now, amr: [{ method: 'password', timestamp: now }] }
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.dGVzdA`
    localStorage.setItem(`sb-${new URL(origin).hostname.split('.')[0]}-auth-token`, JSON.stringify({ access_token: token, refresh_token: 'test-refresh-token', expires_at: now + 3600, user, token_type: 'bearer' }))
  }, { user, origin })
  await page.route(`${origin}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    let data = []
    if (path.includes('/auth/')) data = user
    if (path.endsWith('/folders')) data = [folder, subfolder]
    if (path.endsWith('/files')) data = files
    if (path.endsWith('/activity')) data = []
    if (path.endsWith('/profiles')) data = { id, display_name: 'Player', avatar_url: '/avatars/avatar-01.jpeg', theme: 'pixel-night', notifications: true }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
}

async function openSortFolder(page) {
  await signedIn(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'SKIP ↗' }).click()
  await expect(page.getByText('Sort Test', { exact: true })).toBeVisible()
  await page.getByText('Sort Test', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Folders & files' })).toBeVisible()
}

test('sort control orders files by most recently modified and by name', async ({ page }) => {
  await openSortFolder(page)
  const sort = page.getByLabel('Sort by')
  await expect(sort).toBeVisible()
  await expect(sort).toHaveValue('modified')
  // Default order is most recently modified.
  await expect(page.locator('.file-name strong')).toHaveText(['zebra.txt', 'archive', 'mango.txt', 'apple.txt'])
  await sort.selectOption('name')
  await expect(page.locator('.file-name strong')).toHaveText(['apple.txt', 'archive', 'mango.txt', 'zebra.txt'])
  // The same order applies in grid view.
  await page.getByRole('button', { name: 'Grid view' }).click()
  await expect(page.locator('.grid-file strong')).toHaveText(['apple.txt', 'archive', 'mango.txt', 'zebra.txt'])
})

test('sorting composes with search', async ({ page }) => {
  await openSortFolder(page)
  const sort = page.getByLabel('Sort by')
  await sort.selectOption('name')
  const search = page.getByPlaceholder('Search your cloud')
  await search.fill('man')
  await expect(page.locator('.file-name strong')).toHaveText(['mango.txt'])
  await search.fill('')
  await expect(page.locator('.file-name strong')).toHaveText(['apple.txt', 'archive', 'mango.txt', 'zebra.txt'])
})

test('sort control fits a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSortFolder(page)
  await expect(page.getByLabel('Sort by')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
