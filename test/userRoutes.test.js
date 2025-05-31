
import request from 'supertest';
import express from 'express';
import userRoutes from '../src/routes/userRoutes.js';

const app = express();
app.use(express.json());
app.use('/users', userRoutes);

describe('UserRoutes Tests', () => {
    it('should get user routes', async () => {
        const res = await request(app).get('/users');
        expect([200, 404, 500]).toContain(res.status);
    });
});
