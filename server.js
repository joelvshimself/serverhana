import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import userRoutes from './src/routes/userRoutes.js';
import twoFARoutes from './src/routes/twoFARoutes.js';
import crudr from './src/routes/crudr.js';
import inventarioRoutes from './src/routes/inventarioRoutes.js';    
import setupSwagger from './src/config/swaggerConfig.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Logging
app.use(morgan('dev'));

// 2FA/Auth
app.use('/api/auth', twoFARoutes);

// Healthcheck
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'API funcionando correctamente' });
});

// Swagger UI
setupSwagger(app);

// Rutas específicas
app.use('/api/inventario', inventarioRoutes);  
app.use('/api', crudr);
app.use('/api', userRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Swagger Docs en http://localhost:${PORT}/api-docs`);
});
