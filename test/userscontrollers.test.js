import request from 'supertest';
import express from 'express';
import * as userController from '../src/controllers/userController.js';  // Importa todo el controlador
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Creamos una app Express solo para pruebas
const app = express();
app.use(express.json());

// Simulamos rutas con los controladores
app.post('/api/login', userController.loginUser);
app.put('/api/users/:id', userController.updateUser);
app.delete('/api/users/:id', userController.deleteUser);
app.post('/api/users', userController.createUser);

jest.mock('bcryptjs');

// Mock para las cookies
function setCookies(req, cookies) {
  req.cookies = cookies;
}

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

    it('should return 401 if user is not found', async () => {
      // Mock de la base de datos para que no encuentre usuario
      const mockPrepare = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([]) // No hay usuarios
      }));
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve({ prepare: mockPrepare });

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'notfound@example.com', password: '123' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Credenciales incorrectas');

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });

    it('should return 401 if password is incorrect', async () => {
      // Mock de la base de datos para que encuentre usuario
      const user = {
        ID: 1,
        EMAIL: 'test@example.com',
        PASSWORD: 'hashedPassword',
        TWOFASECRET: null
      };
      const mockPrepare = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([user])
      }));
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve({ prepare: mockPrepare });

      // Mock bcrypt para que la contraseña no coincida
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'test@example.com', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Credenciales incorrectas');

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
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

  describe('POST /api/login (2FA enabled/disabled)', () => {
    it('should return 200 and twoFAEnabled=true if user has 2FA', async () => {
      const user = {
        ID: 3,
        EMAIL: 'Jorge5278222@tec.mx',
        PASSWORD: '123',
        TWOFASECRET: 'G43WKPCXEEXW2W2SMFEDUNKEPA3U6OTGGF5GYWZ4N5RT62DUPU7A',
        ROL: 'string'
      };
      const mockPrepare = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([user])
      }));
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve({ prepare: mockPrepare });
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'test2fa@example.com', password: '123' });

      expect(res.status).toBe(200);
      expect(res.body.twoFAEnabled).toBe(true);
      expect(res.body.message).toMatch(/2FA/i);

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });

    it('should return 200 and twoFAEnabled=false if user does not have 2FA', async () => {
      const user = {
        ID: 2,
        EMAIL: 'testno2fa@example.com',
        PASSWORD: 'hashedPassword',
        TWOFASECRET: null,
        ROL: 'user'
      };
      const mockPrepare = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([user])
      }));
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve({ prepare: mockPrepare });
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'testno2fa@example.com', password: '123' });

      expect(res.status).toBe(200);
      expect(res.body.twoFAEnabled).toBe(false);
      expect(res.body.message).toMatch(/2FA/i);

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });
  });

  describe('GET /api/auth-status', () => {
    beforeAll(() => {
      process.env.JWT_SECRET = 'testsecret';
    });

    it('should return authenticated if Auth cookie is valid', async () => {
      const token = jwt.sign({ userId: 1, email: 'a', rol: 'user' }, process.env.JWT_SECRET);
      app.get('/api/auth-status', (req, res) => {
        req.cookies = { Auth: token };
        userController.authStatus(req, res);
      });
      const res = await request(app).get('/api/auth-status');
      expect(res.body.authStatus).toBe('authenticated');
    });

    it('should return pre-2fa if PreAuth cookie is valid', async () => {
      const token = jwt.sign({ userId: 1, email: 'a', rol: 'user', step: 'pre-2fa' }, process.env.JWT_SECRET);
      app.get('/api/auth-status-pre', (req, res) => {
        req.cookies = { PreAuth: token };
        userController.authStatus(req, res);
      });
      const res = await request(app).get('/api/auth-status-pre');
      expect(res.body.authStatus).toBe('pre-2fa');
    });

    it('should return none if no cookies are present', async () => {
      app.get('/api/auth-status-none', (req, res) => {
        req.cookies = {};
        userController.authStatus(req, res);
      });
      const res = await request(app).get('/api/auth-status-none');
      expect(res.body.authStatus).toBe('none');
    });
  });

  describe('GET /api/user-info', () => {
    it('should return user info if Auth token is valid', async () => {
      const token = jwt.sign({ userId: 1, email: 'a', rol: 'user' }, process.env.JWT_SECRET);
      app.get('/api/user-info', (req, res) => {
        req.cookies = { Auth: token };
        userController.getUserInfo(req, res);
      });
      const res = await request(app).get('/api/user-info');
      expect(res.body.email).toBe('a');
      expect(res.body.role).toBe('user');
      expect(res.body.userId).toBe(1);
      expect(res.body.twoFa).toBe(true);
    });

    it('should return user info with twoFa=false if PreAuth token is valid', async () => {
      const token = jwt.sign({ userId: 2, email: 'b', rol: 'admin', step: 'pre-2fa' }, process.env.JWT_SECRET);
      app.get('/api/user-info-pre', (req, res) => {
        req.cookies = { PreAuth: token };
        userController.getUserInfo(req, res);
      });
      const res = await request(app).get('/api/user-info-pre');
      expect(res.body.email).toBe('b');
      expect(res.body.role).toBe('admin');
      expect(res.body.userId).toBe(2);
      expect(res.body.twoFa).toBe(false);
    });

    it('should return 401 if no token is present', async () => {
      app.get('/api/user-info-none', (req, res) => {
        req.cookies = {};
        userController.getUserInfo(req, res);
      });
      const res = await request(app).get('/api/user-info-none');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should return 404 if user to delete is not found', async () => {
      const mockPrepare = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([]) // No hay usuario
      }));
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve({ prepare: mockPrepare });

      app.delete('/api/users/:id', userController.deleteUser);

      const res = await request(app).delete('/api/users/999');
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no encontrado/i);

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });

    it('should delete user and return success message', async () => {
      const mockPrepare = jest.fn()
        .mockImplementationOnce(() => ({
          exec: jest.fn().mockResolvedValue([{ ID_USUARIO: 1 }]) // Usuario existe
        }))
        .mockImplementationOnce(() => ({
          exec: jest.fn().mockResolvedValue() // Eliminación exitosa
        }));
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve({ prepare: mockPrepare });

      app.delete('/api/users/:id', userController.deleteUser);

      const res = await request(app).delete('/api/users/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/eliminado/i);

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return 404 if user is not found', async () => {
      const mockPrepare = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([]) // No hay usuario
      }));
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve({ prepare: mockPrepare });

      app.get('/api/users/:id', userController.getUserById);

      const res = await request(app).get('/api/users/999');
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no encontrado/i);

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });
  });

  describe('POST /api/users', () => {
    it('should return 400 if password is missing', async () => {
      app.post('/api/users', userController.createUser);
      const res = await request(app).post('/api/users').send({ nombre: 'Test', email: 'test@x.com', rol: 'user' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/contraseña.*obligatoria/i);
    });

    it('should create user and return 201', async () => {
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashedPassword');
      const mockExec = jest.fn().mockResolvedValue();
      const mockPool = {
        exec: mockExec
      };
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve(mockPool);

      app.post('/api/users', userController.createUser);

      const res = await request(app).post('/api/users').send({
        nombre: 'Test',
        email: 'test@x.com',
        password: '123',
        rol: 'user'
      });
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/creado/i);

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });
  });

  describe('GET /api/users', () => {
    it('should return all users', async () => {
      const mockUsers = [{ ID: 1, EMAIL: 'a' }, { ID: 2, EMAIL: 'b' }];
      const mockPrepare = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockUsers)
      }));
      const mockPool = { prepare: mockPrepare };
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve(mockPool);

      app.get('/api/users', userController.getUsers);

      const res = await request(app).get('/api/users');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUsers);

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });

    it('should return 500 on db error', async () => {
      const mockPrepare = jest.fn().mockImplementation(() => { throw new Error('DB error'); });
      const mockPool = { prepare: mockPrepare };
      const originalPoolPromise = require('../src/config/dbConfig.js').poolPromise;
      require('../src/config/dbConfig.js').poolPromise = Promise.resolve(mockPool);

      app.get('/api/users', userController.getUsers);

      const res = await request(app).get('/api/users');
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/db error/i);

      require('../src/config/dbConfig.js').poolPromise = originalPoolPromise;
      jest.clearAllMocks();
    });
  });
});
