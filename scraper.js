const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

module.exports = async function scrapeInstagramComments(username, password, postUrl) {
  // АРГУМЕНТИ ДЛЯ RENDER.COM:
  const browser = await puppeteer.launch({
    headless: true, // true або 'new' для останніх версій
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--single-process' // Важливо для деяких хмарних середовищ
    ]
  });
  const page = await browser.newPage();

  // Налаштування для уникнення виявлення
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });


  // --- Логіка входу ---
  const cookiesPath = path.resolve(__dirname, 'cookies.json');
  let loggedIn = false;

  if (fs.existsSync(cookiesPath)) {
    try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        await page.setCookie(...cookies);
        await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

        // Перевірка, чи вхід був успішним
        await page.waitForSelector('main[role="main"]', { timeout: 10000 });
        loggedIn = true;
    } catch {
        console.log('Cookies expired or invalid. Re-logging in.');
        loggedIn = false;
    }
  }

  if (!loggedIn) {
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });
    
    // Використовуємо більш універсальний селектор для кнопки входу
    await page.click('button[type="submit"]');
    
    // Чекаємо навігації або елемента, який сигналізує про успішний вхід
    try {
        await page.waitForSelector('main[role="main"]', { timeout: 15000 });
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    } catch (e) {
        // Якщо вхід не вдався, кидаємо помилку
        await browser.close();
        throw new Error("Instagram login failed. Check credentials.");
    }
  }

  // --- Скрапінг коментарів ---
  await page.goto(postUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('article', { timeout: 15000 });

  // Показати всі коментарі (виправлений та надійніший селектор)
  console.log('Attempting to load all comments...');
  let hasMoreComments = true;
  while (hasMoreComments) {
    try {
      // Шукаємо кнопку "View more comments"
      const moreBtn = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(button => button.textContent.includes('Завантажити більше коментарів') || button.textContent.includes('View more comments'));
      });

      if (!moreBtn || moreBtn.asElement() === null) {
        hasMoreComments = false;
        break;
      }

      await moreBtn.asElement().click();
      await page.waitForTimeout(2000); 
    } catch (e) {
      console.log('No more "View more comments" buttons found or error clicking.');
      hasMoreComments = false;
    }
  }
  
  // Витягуємо коментарі
  const comments = await page.evaluate(() => {
    // Шукаємо блок коментарів у межах статті
    const commentBlocks = document.querySelectorAll('article ul li');
    const result = [];

    commentBlocks.forEach(block => {
      // Перший елемент - це, як правило, сам пост, ми його пропускаємо.
      // Кожен коментар має посилання на користувача (a-tag з h3)
const userLink = block.querySelector('h3 a');
      const textSpan = block.querySelector('h3 + span, h3 + div > span'); // Селектор тексту коментаря
      const avatar = block.querySelector('img[alt$="user profile picture"]')?.src || '';
      
      const name = userLink ? userLink.textContent : 'Unknown';
      const text = textSpan ? textSpan.textContent : '';
      
      if (text && name !== 'Unknown' && text.length > 5) { // Фільтруємо за наявністю тексту і імені
          result.push({ 
              name: name, 
              text: text, 
              avatar: avatar, 
              date: new Date().toLocaleDateString('uk-UA') 
          });
      }
    });

    return result;
  });

  await browser.close();
  return comments;
};
