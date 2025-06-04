// test/inventario.test.js

import request from 'supertest';
import express from 'express';

// Mock del middleware de autorización para que siempre deje pasar
jest.mock('../src/middleware/auth.js', () => ({
  auth: (...roles) => (req, res, next) => next()
}));

// Mock de poolPromise para controlar ejecuciones de queries
jest.mock('../src/config/dbConfig.js', () => ({
  poolPromise: Promise.resolve({
    exec: jest.fn()
  })
}));

import inventoryRoutes from '../src/routes/inventarioRoutes.js';
import { poolPromise } from '../src/config/dbConfig.js';

const app = express();
app.use(express.json());
app.use('/inventario', inventoryRoutes);

describe('Inventario Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /inventario/', () => {
    it('debe devolver lista de inventario disponible (200)', async () => {
      // Mock de resultado esperado
      const mockDisponible = [
        { PRODUCTO: 'arrachera', CANTIDAD: 5 },
        { PRODUCTO: 'ribeye', CANTIDAD: 2 }
      ];
      // Interceptar la ejecución de exec para el endpoint disponible
      const mockExec = jest.fn().mockResolvedValue(mockDisponible);
      // poolPromise.then(cb) ejecutará cb({ exec: mockExec })
      poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

      const res = await request(app).get('/inventario/');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual(mockDisponible);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("SELECT PRODUCTO"),
      );
    });

    it('debe devolver 500 si hay error en BD al obtener inventario disponible', async () => {
      const mockExec = jest.fn().mockRejectedValue(new Error('fail disponible'));
      poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

      const res = await request(app).get('/inventario/');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', expect.stringContaining('fail disponible'));
    });
  });

  describe('GET /inventario/vendido', () => {
    it('debe devolver lista de inventario vendido (200)', async () => {
      const mockVendido = [
        { PRODUCTO: 'arrachera', CANTIDAD: 3 },
        { PRODUCTO: 'tomahawk', CANTIDAD: 1 }
      ];
      const mockExec = jest.fn().mockResolvedValue(mockVendido);
      poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

      const res = await request(app).get('/inventario/vendido');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual(mockVendido);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("SELECT PRODUCTO"),
      );
    });

    it('debe devolver 500 si hay error en BD al obtener inventario vendido', async () => {
      const mockExec = jest.fn().mockRejectedValue(new Error('fail vendido'));
      poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

      const res = await request(app).get('/inventario/vendido');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', expect.stringContaining('fail vendido'));
    });
  });
});
