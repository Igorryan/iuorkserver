import express from 'express';
import cors from 'cors';

import professionalsRouter from './routes/professionals';
import servicesRouter from './routes/services';
import reviewsRouter from './routes/reviews';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'iUork API' });
});

app.use('/professionals', professionalsRouter);
app.use('/services', servicesRouter);
app.use('/reviews', reviewsRouter);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
