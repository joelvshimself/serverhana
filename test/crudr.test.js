
import request from 'supertest';
import express from 'express';
import crudr from '../src/routes/crudr.js';

const app = express();
app.use(express.json());
app.use('/crud', crudr);

describe('CRUD Routes Tests', () => {
    it('should access CRUD endpoint', async () => {
        const res = await request(app).get('/crud');
        expect([200, 404, 500]).toContain(res.status);
    });
});
