import request from 'supertest';
import express from 'express';
import crudr from '../src/routes/crudr.js';
import { jest } from '@jest/globals';
import { poolPromise } from '../src/config/dbConfig.js';

const app = express();
app.use(express.json());
app.use('/crud', crudr);

jest.mock('../src/config/dbConfig.js', () => ({
  poolPromise: Promise.resolve({
    exec: jest.fn()
  })
}));

describe('CRUD Routes Tests', () => {
  it('should access CRUD endpoint', async () => {
    const res = await request(app).get('/crud');
    expect([200, 404, 500]).toContain(res.status);
  });
});

describe('CRUDR Nueva Orden', () => {
  it('should return 400 if missing fields', async () => {
    const res = await request(app).post('/crud/nuevaorden').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/faltan campos/i);
  });

  it('should return 404 if solicitante not found', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce([]); // No solicitante
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).post('/crud/nuevaorden').send({
      correo_solicita: 'a@a.com',
      correo_provee: 'b@b.com',
      productos: [],
      fecha_emision: '2025-05-23'
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/solicitante/i);
  });

  it('should return 404 if proveedor not found', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce([{ ID_SOLICITA: 1 }]) // solicitante ok
      .mockResolvedValueOnce([]); // proveedor no
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).post('/crud/nuevaorden').send({
      correo_solicita: 'a@a.com',
      correo_provee: 'b@b.com',
      productos: [],
      fecha_emision: '2025-05-23'
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/proveedor/i);
  });

  it('should return 400 if product missing fields', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce([{ ID_SOLICITA: 1 }])
      .mockResolvedValueOnce([{ ID_PROVEE: 2 }])
      .mockResolvedValueOnce([ { ID_ORDEN_OUTPUT: 10 } ]);
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).post('/crud/nuevaorden').send({
      correo_solicita: 'a@a.com',
      correo_provee: 'b@b.com',
      productos: [{ producto: 'arrachera', cantidad: 1 }], // falta precio
      fecha_emision: '2025-05-23'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/producto.*nombre, cantidad y precio/i);
  });

  it('should create order and return 201', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce([{ ID_SOLICITA: 1 }])
      .mockResolvedValueOnce([{ ID_PROVEE: 2 }])
      .mockResolvedValueOnce([{ ID_ORDEN_OUTPUT: 10 }])
      .mockResolvedValue({}); // para productos y notificación
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).post('/crud/nuevaorden').send({
      correo_solicita: 'a@a.com',
      correo_provee: 'b@b.com',
      productos: [{ producto: 'arrachera', cantidad: 1, precio: 100 }],
      fecha_emision: '2025-05-23'
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/creada/i);
    expect(res.body.id_orden).toBe(10);
  });
});

describe('CRUDR Vender', () => {
  it('should return 400 if productos is not array', async () => {
    const res = await request(app).post('/crud/vender').send({ productos: 'noarray' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array de productos/i);
  });

  it('should return 400 if producto missing fields', async () => {
    const res = await request(app).post('/crud/vender').send({ productos: [{ producto: 'arrachera' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nombre y cantidad/i);
  });

  it('should return 400 if producto not recognized', async () => {
    const res = await request(app).post('/crud/vender').send({ productos: [{ producto: 'pollo', cantidad: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no reconocido/i);
  });

  it('should return 400 if not enough inventory', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce([{ RESULTADO: 0 }]); // inventario insuficiente
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).post('/crud/vender').send({
      productos: [{ producto: 'arrachera', cantidad: 1 }],
      fecha_emision: '2025-05-23'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/suficiente inventario/i);
  });

  it('should return 201 and venta info on success', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce([{ RESULTADO: 1 }]) // inventario ok
      .mockResolvedValueOnce({}) // insert venta
      .mockResolvedValueOnce([{ ID_VENTA: 5 }]) // id venta
      .mockResolvedValueOnce([{ ID_INVENTARIO: 1 }]) // inventario disponible
      .mockResolvedValue({}); // resto de inserts/updates
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).post('/crud/vender').send({
      productos: [{ producto: 'arrachera', cantidad: 1 }],
      fecha_emision: '2025-05-23'
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/venta realizada/i);
    expect(res.body.id_venta).toBe(5);
    expect(res.body.total).toBeGreaterThan(0);
  });
});

describe('CRUDR Ventas', () => {
  it('should return ventas agrupadas', async () => {
    const mockVentas = [
      { ID_VENTA: 1, TOTAL: 100, FECHA: '2025-05-23', ID_INVENTARIO: 1, COSTO_UNITARIO: 100, PRODUCTO: 'arrachera' },
      { ID_VENTA: 1, TOTAL: 100, FECHA: '2025-05-23', ID_INVENTARIO: 2, COSTO_UNITARIO: 100, PRODUCTO: 'ribeye' },
      { ID_VENTA: 2, TOTAL: 200, FECHA: '2025-05-24', ID_INVENTARIO: 3, COSTO_UNITARIO: 200, PRODUCTO: 'tomahawk' }
    ];
    poolPromise.then = jest.fn(cb => cb({ exec: jest.fn().mockResolvedValue(mockVentas) }));

    const res = await request(app).get('/crud/ventas');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('productos');
  });

  it('should return 500 on ventas error', async () => {
    poolPromise.then = jest.fn(cb => cb({ exec: jest.fn().mockRejectedValue(new Error('fail')) }));

    const res = await request(app).get('/crud/ventas');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/ventas/i);
  });

  it('should delete venta', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce({}) // DetalleVenta delete
      .mockResolvedValueOnce({}); // Venta delete
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).delete('/crud/ventas/1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/eliminada/i);
  });

  it('should update venta', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce({}) // DetalleVenta delete
      .mockResolvedValueOnce([{ ID_INVENTARIO: 1 }, { ID_INVENTARIO: 2 }]) // inventario
      .mockResolvedValueOnce({}) // DetalleVenta insert
      .mockResolvedValueOnce({}) // update venta
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).put('/crud/ventas/1').send({
      productos: [{ nombre: 'arrachera', cantidad: 2, costo_unitario: 100 }]
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/actualizada/i);
  });

  it('should return 400 if productos missing or empty on update', async () => {
    const res = await request(app).put('/crud/ventas/1').send({ productos: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lista de productos/i);
  });

  it('should return 400 if not enough units on update', async () => {
    const mockExec = jest.fn()
      .mockResolvedValueOnce({}) // DetalleVenta delete
      .mockResolvedValueOnce([]); // inventario insuficiente
    poolPromise.then = jest.fn(cb => cb({ exec: mockExec }));

    const res = await request(app).put('/crud/ventas/1').send({
      productos: [{ nombre: 'arrachera', cantidad: 2, costo_unitario: 100 }]
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no hay suficientes/i);
  });
});
