import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan'; 
import userRoutes from './src/routes/userRoutes.js';
import setupSwagger from './src/config/swaggerConfig.js';
import twoFARoutes from './src/routes/twoFARoutes.js';
import crudr from './src/routes/crudr.js';
import inventarioRoutes from './src/routes/inventarioRoutes.js';    


dotenv.config();

const app = express();

// Poner origin de produccion despues tambien
app.use(cors({
  origin: "http://localhost:5173", // frontend
  credentials: true,               // allow sending cookies
}));

app.use(express.json());
import cookieParser from 'cookie-parser';
app.use(cookieParser());
app.use('/api/auth', twoFARoutes);

// Configurar Morgan 
app.use(morgan('dev'));

// Configurar Swagger
setupSwagger(app);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'API funcionando correctamente' });
});

app.use('/api', crudr);

// Luego las rutas de usuarios
app.use('/api', userRoutes);
app.use('/api/inventario', inventarioRoutes);  


// Port y terminal Host
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Swagger Docs en http://localhost:${PORT}/api-docs`);
});
