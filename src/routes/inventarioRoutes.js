// server/src/routes/inventarioRoutes.js
import { Router } from "express";
import { poolPromise } from '../config/dbConfig.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Inventario
 *   description: Gestión de inventario disponible
 */

/**
 * @swagger
 * /api/inventario:
 *   get:
 *     summary: Obtener inventario disponible
 *     description: Devuelve la cantidad de unidades disponibles agrupadas por producto.
 *     tags:
 *       - Inventario
 *     responses:
 *       200:
 *         description: Lista de productos y su cantidad disponible.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   PRODUCTO:
 *                     type: string
 *                     description: Nombre del producto.
 *                   CANTIDAD:
 *                     type: integer
 *                     description: Cantidad disponible.
 *       500:
 *         description: Error interno del servidor.
 */
router.get("/", async (req, res) => {
  try {
    const connection = await poolPromise;
    const result = await connection.exec(`
      SELECT PRODUCTO,
             COUNT(*) AS CANTIDAD
      FROM INVENTARIO
      WHERE ESTADO = 'disponible'
      GROUP BY PRODUCTO
    `);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;