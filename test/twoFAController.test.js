
import request from 'supertest';
import express from 'express';
import * as twoFAController from '../src/controllers/twoFAController.js';


const app = express();
app.use(express.json());
app.post('/api/2fa/send', twoFAController.sendCode);
app.post('/api/2fa/verify', twoFAController.verifyCode);

describe('TwoFAController Tests', () => {
    it('should return error for missing code', async () => {
        const res = await request(app).post('/api/2fa/verify').send({});
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
