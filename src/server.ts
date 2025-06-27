import App from './core/App';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

const app = new App();
app.listen(PORT);
