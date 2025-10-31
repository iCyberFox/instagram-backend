const express = require('express');
const bodyParser = require('body-parser');
const scrapeInstagramComments = require('./scraper');

const app = express();
app.use(bodyParser.json());

app.post('/getInstagramComments', async (req, res) => {
  const { username, password, postUrl } = req.body;

  if (!username  !password  !postUrl) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const comments = await scrapeInstagramComments(username, password, postUrl);
    res.json({ comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scraping failed' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});