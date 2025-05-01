import express from "express";
import { generate2FA, verify2FA, check2FAStatus } from "../controllers/twoFAController.js";

const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: 2FA
 *   description: Autenticación en dos pasos con Google Authenticator
 */

/**
 * @swagger
 * /api/auth/2fa/generate:
 *   post:
 *     summary: Genera código QR y secreto de 2FA para el usuario
 *     tags: [2FA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Secreto generado
 */
router.post("/2fa/generate", generate2FA);
/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Verifica el código 2FA ingresado por el usuario
 *     tags: [2FA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verificación exitosa
 *       401:
 *         description: Código incorrecto
 */
router.post("/2fa/verify", verify2FA);
/**
 * @swagger
 * /api/auth/2fa/status:
 *   post:
 *     summary: Verifica si el usuario tiene activado 2FA
 *     tags: [2FA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Estado de 2FA
 */
router.post("/2fa/status", check2FAStatus);

export default router;
