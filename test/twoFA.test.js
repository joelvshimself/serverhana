// test/twoFA.test.js

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import {
  generate2FA,
  verify2FA,
  check2FAStatus,
  reset2FA
} from '../src/controllers/twoFAController.js';

// Mocks
jest.mock('../src/config/dbConfig.js', () => ({
  poolPromise: {
    prepare: jest.fn()
  }
}));

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: {
    verify: jest.fn()
  }
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}));

import { poolPromise } from '../src/config/dbConfig.js';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import jwt from 'jsonwebtoken';

describe('twoFAController', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Middleware stub: lee header 'x-preauth' y asigna a req.preAuth
    const attachPreAuth = (req, res, next) => {
      try {
        req.preAuth = JSON.parse(req.headers['x-preauth'] || '{}');
      } catch {
        req.preAuth = {};
      }
      next();
    };

    // Route for generate2FA
    app.post(
      '/generate2fa',
      attachPreAuth,
      generate2FA
    );

    // Route for verify2FA
    app.post(
      '/verify2fa',
      attachPreAuth,
      verify2FA
    );

    // Route for check2FAStatus
    app.get(
      '/check2fa',
      attachPreAuth,
      check2FAStatus
    );

    // Route for reset2FA (no preAuth needed)
    app.post('/reset2fa', reset2FA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate2FA', () => {
    it('debe devolver 400 si falta email en req.preAuth', async () => {
      const res = await request(app)
        .post('/generate2fa')
        .set('x-preauth', JSON.stringify({})); 
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Token inválido: falta email/i)
      );
    });

    it('debe generar y devolver qr y otpauth_url correctamente', async () => {
      const fakeEmail = 'user@example.com';
      const fakeSecret = {
        base32: 'BASE32SECRET',
        otpauth_url: 'otpauth://totp/ViBa%20(user@example.com)?secret=BASE32SECRET'
      };
      const fakeQRCodeDataURL = 'data:image/png;base64,FAKEPNG';

      // Mock preAuth.email
      const preAuth = { email: fakeEmail };

      // Mock speakeasy.generateSecret
      speakeasy.generateSecret.mockReturnValue(fakeSecret);

      // Mock poolPromise.prepare y stmt.exec
      const fakeStmt = { exec: jest.fn().mockResolvedValue({}) };
      poolPromise.prepare.mockResolvedValue(fakeStmt);

      // Mock qrcode.toDataURL
      qrcode.toDataURL.mockResolvedValue(fakeQRCodeDataURL);

      const res = await request(app)
        .post('/generate2fa')
        .set('x-preauth', JSON.stringify(preAuth));

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: `ViBa (${fakeEmail})`
      });
      expect(poolPromise.prepare).toHaveBeenCalledWith(`
      UPDATE USUARIO SET "TWOFASECRET" = ? WHERE "EMAIL" = ?
    `);
      expect(fakeStmt.exec).toHaveBeenCalledWith([
        fakeSecret.base32,
        fakeEmail
      ]);
      expect(qrcode.toDataURL).toHaveBeenCalledWith(
        fakeSecret.otpauth_url
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        qr: fakeQRCodeDataURL,
        otpauth_url: fakeSecret.otpauth_url
      });
    });

    it('debe devolver 500 si ocurre error interno', async () => {
      // Forzar poolPromise.prepare a arrojar error
      poolPromise.prepare.mockImplementationOnce(() => {
        throw new Error('DB failure');
      });

      const res = await request(app)
        .post('/generate2fa')
        .set(
          'x-preauth',
          JSON.stringify({ email: 'user@example.com' })
        );

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Error generando 2FA/i)
      );
    });
  });

  describe('verify2FA', () => {
    it('debe devolver 401 si decoded.step !== "pre-2fa"', async () => {
      const res = await request(app)
        .post('/verify2fa')
        .set('x-preauth', JSON.stringify({ step: 'wrong-step' }))
        .send({ token: '123456' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Token inválido para 2FA/i)
      );
    });

    it('debe devolver 400 si falta token en body', async () => {
      const res = await request(app)
        .post('/verify2fa')
        .set(
          'x-preauth',
          JSON.stringify({ step: 'pre-2fa', email: 'user@example.com' })
        )
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Falta código 2FA/i)
      );
    });

    it('debe devolver 404 si usuario no encontrado en BD', async () => {
      // Mock poolPromise.prepare y stmt.exec para retornar array vacío
      const fakeStmt = { exec: jest.fn().mockResolvedValue([]) };
      poolPromise.prepare.mockResolvedValue(fakeStmt);

      const res = await request(app)
        .post('/verify2fa')
        .set(
          'x-preauth',
          JSON.stringify({ step: 'pre-2fa', email: 'user@example.com' })
        )
        .send({ token: '123456' });

      expect(poolPromise.prepare).toHaveBeenCalledWith(
        `SELECT * FROM USUARIO WHERE "EMAIL" = ?`
      );
      expect(fakeStmt.exec).toHaveBeenCalledWith([
        'user@example.com'
      ]);
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Usuario no encontrado/i)
      );
    });

    it('debe devolver 401 si código 2FA inválido', async () => {
      const fakeUser = {
        ID: 1,
        EMAIL: 'user@example.com',
        ROL: 'user',
        TWOFASECRET: 'BASE32SECRET',
        NOMBRE: 'User'
      };
      const fakeStmt = { exec: jest.fn().mockResolvedValue([fakeUser]) };
      poolPromise.prepare.mockResolvedValue(fakeStmt);

      // mock speakeasy.totp.verify para que retorne false
      speakeasy.totp.verify.mockReturnValue(false);

      const res = await request(app)
        .post('/verify2fa')
        .set(
          'x-preauth',
          JSON.stringify({ step: 'pre-2fa', email: 'user@example.com' })
        )
        .send({ token: '000000' });

      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: fakeUser.TWOFASECRET,
        encoding: 'base32',
        token: '000000',
        window: 1
      });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Código 2FA inválido/i)
      );
    });

    it('debe devolver 200, limpiar cookie PreAuth y establecer cookies Auth y UserData al verificar exitosamente', async () => {
      const fakeUser = {
        ID: 1,
        EMAIL: 'user@example.com',
        ROL: 'user',
        TWOFASECRET: 'BASE32SECRET',
        NOMBRE: 'User'
      };
      const fakeStmt = { exec: jest.fn().mockResolvedValue([fakeUser]) };
      poolPromise.prepare.mockResolvedValue(fakeStmt);

      // mock speakeasy.totp.verify para que retorne true
      speakeasy.totp.verify.mockReturnValue(true);
      // mock jwt.sign
      jwt.sign.mockReturnValue('FINAL.JWT.TOKEN');

      const res = await request(app)
        .post('/verify2fa')
        .set(
          'x-preauth',
          JSON.stringify({ step: 'pre-2fa', email: 'user@example.com' })
        )
        .send({ token: '123456' });

      // Verificar encabezados de 'set-cookie'
      const setCookies = res.header['set-cookie'];
      expect(
        setCookies.some((c) =>
          c.startsWith('Auth=FINAL.JWT.TOKEN')
        )
      ).toBe(true);
      expect(
        setCookies.some((c) => c.startsWith('UserData='))
      ).toBe(true);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: '2FA exitoso',
        success: true
      });
    });

    it('debe devolver 500 si ocurre error interno en verify2FA', async () => {
      // Forzar poolPromise.prepare a arrojar error
      poolPromise.prepare.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const res = await request(app)
        .post('/verify2fa')
        .set(
          'x-preauth',
          JSON.stringify({ step: 'pre-2fa', email: 'user@example.com' })
        )
        .send({ token: '123456' });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Error al verificar 2FA/i)
      );
    });
  });

  describe('check2FAStatus', () => {
    it('debe devolver 404 si twoFAEnabled es falso o vacío', async () => {
      const res1 = await request(app)
        .get('/check2fa')
        .set('x-preauth', JSON.stringify({ twoFAEnabled: null }));
      expect(res1.status).toBe(404);
      expect(res1.body).toEqual({
        success: false,
        message: 'Usuario no encontrado'
      });

      const res2 = await request(app)
        .get('/check2fa')
        .set('x-preauth', JSON.stringify({ twoFAEnabled: [] }));
      expect(res2.status).toBe(404);
      expect(res2.body).toEqual({
        success: false,
        message: 'Usuario no encontrado'
      });
    });

    it('debe devolver 200 con { twoFAEnabled } cuando existe valor válido', async () => {
      const res = await request(app)
        .get('/check2fa')
        .set('x-preauth', JSON.stringify({ twoFAEnabled: true }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ twoFAEnabled: true });
    });
  });

  describe('reset2FA', () => {
    it('debe devolver 400 si falta email en body', async () => {
      const res = await request(app)
        .post('/reset2fa')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Email es requerido/i)
      );
    });

    it('debe devolver 200 y mensaje correcto al resetear 2FA', async () => {
      // Mock poolPromise.prepare y stmt.exec
      const fakeStmt = { exec: jest.fn().mockResolvedValue({}) };
      poolPromise.prepare.mockResolvedValue(fakeStmt);

      const targetEmail = 'user@example.com';
      const res = await request(app)
        .post('/reset2fa')
        .send({ email: targetEmail });

      expect(poolPromise.prepare).toHaveBeenCalledWith(`
      UPDATE USUARIO SET "TWOFASECRET" = NULL WHERE "EMAIL" = ?
    `);
      expect(fakeStmt.exec).toHaveBeenCalledWith([targetEmail]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: `2FA reseteado para ${targetEmail}`
      });
    });

    it('debe devolver 500 si ocurre error interno en reset2FA', async () => {
      poolPromise.prepare.mockImplementationOnce(() => {
        throw new Error('DB reset error');
      });
      const res = await request(app)
        .post('/reset2fa')
        .send({ email: 'user@example.com' });
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty(
        'message',
        expect.stringMatching(/Error al resetear 2FA/i)
      );
    });
  });
});
