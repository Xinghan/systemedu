import {chromium} from '@playwright/test'
import fs from 'node:fs/promises'
await fs.mkdir('artifacts/energy-project-line',{recursive:true})
const browser=await chromium.launch({args:['--no-proxy-server']})
const page=await browser.newPage({viewport:{width:1400,height:1050}})
page.on('pageerror',e=>console.log('ERROR',String(e)))
await page.goto('http://localhost:4000/explore/energy-motion/spin-a-flywheel')
await page.locator('[data-energy-workspace] fieldset').waitFor()
await page.locator('canvas').waitFor({timeout:60000})
await page.locator('[data-energy-workspace]').screenshot({path:'artifacts/energy-project-line/machine-first.png'})
await browser.close()
