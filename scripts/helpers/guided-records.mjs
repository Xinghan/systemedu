// 在分步课堂记录中进入自由表达；用于继续验证旧文字记录的兼容性。
export async function freeAnswer(page, index, value) {
  const step = page.locator('[data-response-step]').nth(index);
  await step.locator('h4 button').click();
  const switcher = step.getByRole('button', { name: '我想自己组织表达', exact: true });
  if (await switcher.count()) await switcher.click();
  const field = step.locator('[data-free-answer]');
  if (value !== undefined) await field.fill(value);
  return field;
}
