import {chromium,expect} from '@playwright/test'
import fs from 'node:fs/promises'
const browser=await chromium.launch({args:['--no-proxy-server']})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 await page.goto('https://systeme.xin/library?view=lines',{waitUntil:'domcontentloaded'})
 await expect(page.locator('main')).not.toContainText('正在载入开放状态')
 const images=page.locator('main img')
 await expect(images).toHaveCount(5,{timeout:20000})
 for(const image of await images.all()){
  await image.scrollIntoViewIfNeeded()
  await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0),{timeout:45000}).toBe(true)
 }
 await page.evaluate(()=>scrollTo(0,0))
 await page.screenshot({path:'artifacts/rover-release-20260920/production/library-lines.png',fullPage:true})
 await fs.writeFile('artifacts/rover-release-20260920/production/covers-verification.json',JSON.stringify({passed:true,loaded_generated_covers:5}))
 console.log('PASS 正式域名 5 张项目线生成封面均实际加载。')
}finally{await browser.close()}
