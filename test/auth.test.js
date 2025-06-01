
import request from 'supertest';
import express from 'express';
import authMiddleware from '../src/middleware/auth.js';

const app = express();
app.use(authMiddleware, (req, res) => res.status(200).send('Authenticated'));

describe('Auth Middleware Tests', () => {
    it('should fail authentication without token', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
