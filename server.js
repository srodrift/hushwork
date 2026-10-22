import express from 'express';
import hushwork from './src/routes.js';

const app = express();
app.use('/api', hushwork);
app.use(express.static('public', { dotfiles: 'ignore' }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`hushwork → http://localhost:${port}`));
