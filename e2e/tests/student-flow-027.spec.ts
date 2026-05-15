import { test, expect } from "@playwright/test"

/**
 * spec 027 student flow:
 *   注册 -> 登录后到 /home -> 去 /library -> 点 PurpleAir -> Pull
 *   -> 回 /home 看到卡片 -> 进入 /learn/.../M01 -> 看到 iframe (anim/game)
 */
test("注册到首次学习完整流程", async ({ page }) => {
  const username = `e2e_${Date.now()}`
  const password = "e2epass123"

  // 1. 入口跳 /login
  await page.goto("/")
  await expect(page).toHaveURL(/\/login/)

  // 2. 注册
  await page.goto("/register")
  await page.fill('input[id="username"]', username)
  await page.fill('input[id="password"]', password)
  await Promise.all([
    page.waitForURL(/\/home/, { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])
  await expect(page).toHaveURL(/\/home/)

  // 3. 空状态
  await expect(page.getByText("你的书架还是空的")).toBeVisible()

  // 4. 去 Library
  await page.getByRole("link", { name: /Library/i }).first().click()
  await expect(page).toHaveURL(/\/library$/)

  // 5. 找到 PurpleAir 并进入详情
  const card = page.getByRole("link", { name: /PurpleAir/i })
  await expect(card.first()).toBeVisible()
  await card.first().click()
  await expect(page).toHaveURL(/\/library\/purpleair/)

  // 6. Pull
  await page.getByRole("button", { name: /Pull/ }).click()

  // 跳转到 /home, 卡片 + 开始学习按钮
  await page.waitForURL(/\/home/, { timeout: 15000 })
  await expect(page.getByText(/PurpleAir/i).first()).toBeVisible()

  // 7. 点击开始学习
  const startLink = page.getByRole("link", { name: /开始学习|继续学习/ }).first()
  await startLink.click()
  await expect(page).toHaveURL(/\/learn\/purpleair-airquality-node\/M01/)

  // 8. 学习页内容: 标题渲染 + iframe (animation/game) 至少 1 个
  await expect(page.locator("h1").first()).toContainText(/PurpleAir|颗粒|空气|认识/)
  await expect(page.locator("iframe").first()).toBeVisible({ timeout: 15000 })

  // 9. 进度反映: 再回 /home 看 last_module
  await page.goto("/home")
  await expect(page.getByText("最后学到: M01")).toBeVisible()
})

test("退出后访问 /home 跳 /login", async ({ page }) => {
  const username = `e2e_b_${Date.now()}`
  const password = "e2epass123"

  await page.goto("/register")
  await page.fill('input[id="username"]', username)
  await page.fill('input[id="password"]', password)
  await Promise.all([
    page.waitForURL(/\/home/, { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])

  // 打开用户菜单 (header 右上, button 含 username) 点退出
  await page.locator("header button").filter({ hasText: username }).click()
  await page.getByRole("button", { name: /退出登录/ }).click()
  await expect(page).toHaveURL(/\/login/)

  // 再访问 /home → 必须跳 /login
  await page.goto("/home")
  await expect(page).toHaveURL(/\/login/)
})
