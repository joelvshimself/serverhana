import request from 'supertest';
import express from 'express';
import * as twoFAController from '../src/controllers/twoFAController.js';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

jest.mock('../src/config/dbConfig.js', () => ({
  poolPromise: Promise.resolve({
    prepare: jest.fn().mockResolvedValue({
      exec: jest.fn(),
    }),
  }),
}));
jest.mock('speakeasy');
jest.mock('qrcode');

const app = express();
app.use(express.json());

// Mock middlewares para req.preAuth
function mockPreAuth(req, res, next) {
  req.preAuth = { email: 'test@example.com', step: 'pre-2fa', twoFAEnabled: true };
  next();
}

app.post('/api/2fa/generate', mockPreAuth, twoFAController.generate2FA);
app.post('/api/2fa/verify', mockPreAuth, twoFAController.verify2FA);
app.post('/api/2fa/status', mockPreAuth, twoFAController.check2FAStatus);
app.post('/api/2fa/reset', twoFAController.reset2FA);

describe('TwoFAController', () => {
  it('should return 400 if email missing in generate2FA', async () => {
    const app2 = express();
    app2.use(express.json());
    app2.post('/api/2fa/generate', (req, res, next) => { req.preAuth = {}; next(); }, twoFAController.generate2FA);
    const res = await request(app2).post('/api/2fa/generate').send();
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/falta email/i);
  });

  it('should generate 2FA secret and QR', async () => {
    speakeasy.generateSecret.mockReturnValue({ base32: 'secret', otpauth_url: 'otpauth://...' });
    qrcode.toDataURL.mockResolvedValue('data:image/png;base64,QR');
    const res = await request(app).post('/api/2fa/generate').send();
    expect(res.status).toBe(200);
    expect(res.body.qr).toMatch(/^data:image/);
    expect(res.body.otpauth_url).toBeDefined();
  });

  it('should return 400 if token missing in verify2FA', async () => {
    const res = await request(app).post('/api/2fa/verify').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/falta código/i);
  });

  it('should return 401 if step is not pre-2fa', async () => {
    const app2 = express();
    app2.use(express.json());
    app2.post('/api/2fa/verify', (req, res, next) => { req.preAuth = { step: 'other' }; next(); }, twoFAController.verify2FA);
    const res = await request(app2).post('/api/2fa/verify').send({ token: '123456' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/inválido/i);
  });

  it('should return 200 for check2FAStatus', async () => {
    const res = await request(app).post('/api/2fa/status').send();
    expect(res.status).toBe(200);
    expect(res.body.twoFAEnabled).toBe(true);
  });

  it('should return 400 if email missing in reset2FA', async () => {
    const res = await request(app).post('/api/2fa/reset').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email es requerido/i);
  });
});

afterEach(() => {
  jest.clearAllMocks();
});
