import { test, expect } from '@playwright/test'
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const origin='https://sajbwbtqlassnipnbdkk.supabase.co'
async function signedIn(page, {folders=[], files=[]}={}) {
  const user={id,email:'test@example.com',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),identities:[]}
  await page.addInitScript(({user,origin})=>{
    const now=Math.floor(Date.now()/1000)
    const encode=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
    const claims={sub:user.id,iss:`${origin}/auth/v1`,aud:'authenticated',role:'authenticated',is_anonymous:false,exp:now+3600,iat:now,amr:[{method:'password',timestamp:now}]}
    const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode(claims)}.dGVzdA`
    localStorage.setItem(`sb-${new URL(origin).hostname.split('.')[0]}-auth-token`,JSON.stringify({access_token:token,refresh_token:'test-refresh-token',expires_at:now+3600,user,token_type:'bearer'}))
  },{user,origin})
  await page.route(`${origin}/**`,async route=>{
    const path=new URL(route.request().url()).pathname
    let data=[]
    if(path.includes('/auth/')) data=user
    if(path.endsWith('/folders')) data=folders
    if(path.endsWith('/files')) data=files
    if(path.endsWith('/profiles')) data={id,display_name:'Player',avatar_url:'/avatars/avatar-01.jpeg',theme:'pixel-night',notifications:true}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
}
const folder={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:id,parent_id:null,name:'Project Nebula',updated_at:new Date().toISOString(),is_starred:false,trashed_at:null}
const file={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',user_id:id,folder_id:folder.id,name:'notes.txt',mime_type:'text/plain',size_bytes:12,tag:'Notes',storage_path:'test/notes.txt',updated_at:new Date().toISOString(),is_starred:false,trashed_at:null}

test('keyboard Enter opens a folder from the list view',async({page})=>{
  await signedIn(page,{folders:[folder]})
  await page.goto('/')
  await page.getByRole('button',{name:'SKIP ↗'}).click()
  const row=page.getByRole('button',{name:'Open folder Project Nebula'})
  await expect(row).toBeVisible()
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button',{name:'Project Nebula',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Folders & files 0'})).toBeVisible()
})

test('keyboard Space opens file details from the list view',async({page})=>{
  await signedIn(page,{folders:[folder],files:[file]})
  await page.goto('/')
  await page.getByRole('button',{name:'SKIP ↗'}).click()
  await page.getByRole('button',{name:'Open folder Project Nebula'}).focus()
  await page.keyboard.press('Enter')
  const row=page.getByRole('button',{name:'Show details for notes.txt'})
  await expect(row).toBeVisible()
  await row.focus()
  await page.keyboard.press(' ')
  await expect(page.getByLabel('notes.txt details')).toBeVisible()
  await expect(page.getByRole('heading',{name:'notes.txt'})).toBeVisible()
})

test('a focused list row shows a visible focus ring',async({page})=>{
  await signedIn(page,{folders:[folder]})
  await page.goto('/')
  await page.getByRole('button',{name:'SKIP ↗'}).click()
  const row=page.getByRole('button',{name:'Open folder Project Nebula'})
  await expect(row).toBeVisible()
  await page.keyboard.press('Tab')
  await row.focus()
  await expect(row).toBeFocused()
  const shadow=await page.locator('.table-wrap tbody tr td').first().evaluate(el=>getComputedStyle(el).boxShadow)
  expect(shadow).not.toBe('none')
})

test('mouse click still opens a folder from the list view',async({page})=>{
  await signedIn(page,{folders:[folder]})
  await page.goto('/')
  await page.getByRole('button',{name:'SKIP ↗'}).click()
  await page.getByRole('button',{name:'Open folder Project Nebula'}).click()
  await expect(page.getByRole('heading',{name:'Folders & files 0'})).toBeVisible()
})
