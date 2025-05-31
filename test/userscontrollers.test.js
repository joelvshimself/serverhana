import request from 'supertest';
import express from 'express';
import * as userController from '../src/controllers/userController.js';  // Importa todo el controlador

// Creamos una app Express solo para pruebas
const app = express();
app.use(express.json());

// Simulamos rutas con los controladores
app.post('/api/login', userController.loginUser);
app.put('/api/users/:id', userController.updateUser);

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
        email: 'test@example.com',
        password: 'correctpass'
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
  });
});
