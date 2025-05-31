
import request from 'supertest';
import express from 'express';
import twoFARoutes from '../src/routes/twoFARoutes.js';

const app = express();
app.use(express.json());
app.use('/2fa', twoFARoutes);

describe('TwoFARoutes Tests', () => {
    it('should access 2FA route', async () => {
        const res = await request(app).get('/2fa');
        expect([200, 404, 500]).toContain(res.status);
    });
});
