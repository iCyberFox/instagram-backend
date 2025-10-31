const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

module.exports = async function scrapeInstagramComments(username, password, postUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const cookiesPath = path.resolve(dirname, 'cookies.json');
  let loggedIn = false;

  // Спроба використати збережені cookies
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath));
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

    try {
      await page.waitForSelector('nav', { timeout: 5000 });
      loggedIn = true;
    } catch {
      loggedIn = false;
    }
  }

  // Якщо не залогінені — логін через форму
  if (!loggedIn) {
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="username"]');

    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
  }

  // Переходимо на пост
  await page.goto(postUrl, { waitUntil: 'networkidle2' });

  // Клікаємо "Показати ще коментарі" поки можливо
  while (true) {
    try {
      const moreBtn = await page.$x("//button[contains(text(), 'View more comments') or contains(text(), 'Показати більше коментарів')]");
      if (moreBtn.length === 0) break;
      await moreBtn[0].click();
      await page.waitForTimeout(1500);
    } catch {
      break;
    }
  }

  // Витягуємо коментарі
  const comments = await page.evaluate(() => {
    const blocks = document.querySelectorAll('ul > li');
    const result = [];

    blocks.forEach(block => {
      const name = block.querySelector('h3')?.innerText || 'Unknown';
      const text = block.querySelector('span')?.innerText || '';
      const avatar = block.querySelector('img')?.src || '';
      const date = new Date().toLocaleDateString('uk-UA');

      if (text && name !== '...') {
        result.push({ name, text, avatar, date });
      }
    });

    return result;
  });

  await browser.close();
  return comments;
};