import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { generate2FA, verify2FA } from '../src/controllers/twoFAController.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.post('/api/2fa/send', generate2FA);
app.post('/api/2fa/verify', verify2FA);

describe('TwoFAController Tests', () => {
    it('should return error for missing PreAuth token in generate2FA', async () => {
        const res = await request(app).post('/api/2fa/send').send({});
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Falta token PreAuth');
    });

    it('should return error for missing PreAuth token in verify2FA', async () => {
        const res = await request(app).post('/api/2fa/verify').send({ token: '123456' });
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Falta token PreAuth');
    });

    it('should return error for missing code in verify2FA', async () => {
        // Simula cookie PreAuth válida pero falta código
        const fakeToken = 'fake.jwt.token';
        const res = await request(app)
            .post('/api/2fa/verify')
            .set('Cookie', [`PreAuth=${fakeToken}`])
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Falta código 2FA');
    });
});
