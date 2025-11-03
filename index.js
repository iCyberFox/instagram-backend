const express = require('express');
const bodyParser = require('body-parser');
// Переконайтесь, що шлях правильний
const scrapeInstagramComments = require('./scraper.js'); 

const app = express();
app.use(bodyParser.json());

app.post('/getInstagramComments', async (req, res) => {
  const { username, password, postUrl } = req.body;

  // Перевірка наявності необхідних параметрів
  if (!username  !password  !postUrl) {
    return res.status(400).json({ error: 'Missing required parameters: username, password, or postUrl' });
  }

  try {
    console.log(Starting scrape for post: ${postUrl});
    const comments = await scrapeInstagramComments(username, password, postUrl);
    
    // Успішна відповідь
    res.json({ comments });
  } catch (err) {
    console.error('Scraping error:', err.message);
    // Повертаємо помилку 500
    res.status(500).json({ error: Scraping failed: ${err.message} });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(Server running on http://localhost:${PORT});
});
