import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_, res) => res.sendFile('index.html', { root: path.join(__dirname, 'dist') }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] running on http://localhost:${PORT}`));
