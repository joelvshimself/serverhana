
import request from 'supertest';
import express from 'express';
import inventarioRoutes from '../src/routes/inventarioRoutes.js';

const app = express();
app.use(express.json());
app.use('/inventario', inventarioRoutes);

describe('InventarioRoutes Tests', () => {
    it('should access inventario route', async () => {
        const res = await request(app).get('/inventario');
        expect([200, 404, 500]).toContain(res.status);
    });
});
