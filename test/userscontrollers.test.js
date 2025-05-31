import request from 'supertest';
import express from 'express';
import * as userController from '../src/controllers/userController.js';  // Importa todo el controlador
import bcrypt from 'bcryptjs';

// Creamos una app Express solo para pruebas
const app = express();
app.use(express.json());

// Simulamos rutas con los controladores
app.post('/api/login', userController.loginUser);
app.put('/api/users/:id', userController.updateUser);

jest.mock('bcryptjs');

describe('UserController', () => {
  describe('POST /api/login', () => {
    it('should return 400 if missing credentials', async () => {
      const res = await request(app).post('/api/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBeDefined();  // Ajusta según tu código real
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request(app).post('/api/login').send({
        email: 'test@example.com',
        password: 'wrongpass'
      });
      expect(res.status).toBe(401);  // Ajusta según tu lógica real
    });

    it('should return 200 and token for valid login', async () => {
      const res = await request(app).post('/api/login').send({
        email: 'Jorge5278222@tec.mx',
        password: '123'
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should return 400 if data is invalid', async () => {
      const res = await request(app).put('/api/users/1').send({ email: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBeDefined();  // Ajusta según tu código
    });

    it('should return 404 if user not found', async () => {
      const res = await request(app).put('/api/users/9999').send({ email: 'new@example.com' });
      expect(res.status).toBe(404);  // Ajusta según tu código real
      expect(res.body.message).toBeDefined();
    });

    it('should return 200 if update is successful', async () => {
      const res = await request(app).put('/api/users/1').send({ email: 'new@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();  // Ajusta según tu código
    });

    it('should hash password if a new password is provided', async () => {
      // Mock bcrypt
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashedPassword');

      // Simula usuario existente
      const existingUser = {
        ID_USUARIO: 1,
        PASSWORD: 'oldHashedPassword'
      };

      // Mock de la base de datos
      const mockPrepare = jest.fn().mockImplementation((query) => {
        if (query.includes('SELECT')) {
          return { exec: jest.fn().mockResolvedValue([existingUser]) };
        }
        if (query.includes('UPDATE')) {
          return { exec: jest.fn().mockResolvedValue() };
        }
      });

      // Sobrescribe poolPromise temporalmente
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve({ prepare: mockPrepare });

      const res = await request(app)
        .put('/api/users/1')
        .send({ nombre: 'Nuevo', email: 'nuevo@ejemplo.com', password: 'nuevoPass', rol: 'user' });

      expect(bcrypt.hash).toHaveBeenCalledWith('nuevoPass', 'salt');
      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();

      // Limpieza
      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });
  });
});
