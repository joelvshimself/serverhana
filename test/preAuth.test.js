// test/preAuth.test.js

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { preAuth } from '../src/middleware/preAuth.js';

jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.get('/protected', preAuth, (req, res) => {
  // Si preAuth pasa, devolveremos el payload decodificado
  return res.json({ decoded: req.preAuth });
});

describe('preAuth Middleware', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'testsecret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe devolver 401 si no viene cookie PreAuth', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message', expect.stringMatching(/Falta token PreAuth/i));
  });

  it('debe devolver 403 si jwt.verify lanza error', async () => {
    // Simular que jwt.verify arroja error (token inválido o expirado)
    jwt.verify.mockImplementationOnce(() => {
      throw new Error('invalid token');
    });

    const res = await request(app)
      .get('/protected')
      .set('Cookie', 'PreAuth=tokenInválidoDePrueba');
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('message', expect.stringMatching(/Token PreAuth inválido o expirado/i));
  });

  it('debe aceptar token válido y adjuntar req.preAuth', async () => {
    const mockDecoded = { userId: 123, role: 'user' };
    jwt.verify.mockImplementationOnce(() => mockDecoded);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', 'PreAuth=tokenVálidoDePrueba');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ decoded: mockDecoded });
  });
});
