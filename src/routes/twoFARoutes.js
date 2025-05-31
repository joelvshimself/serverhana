import express from "express";
import { generate2FA, verify2FA, check2FAStatus, reset2FA } from "../controllers/twoFAController.js";
import { auth } from "../middleware/auth.js"
import { preAuth } from '../middleware/preAuth.js';

const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: 2FA
 *   description: Autenticación en dos pasos con Google Authenticator
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: PreAuth
 */

/**
 * @swagger
 * /api/auth/2fa/generate:
 *   post:
 *     summary: Genera código QR y secreto de 2FA para el usuario autenticado
 *     tags: [2FA]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Secreto generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qr:
 *                   type: string
 *                   format: data-url
 *                 otpauth_url:
 *                   type: string
 */
router.post("/2fa/generate", preAuth, generate2FA);

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Verifica el código 2FA ingresado por el usuario autenticado
 *     tags: [2FA]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verificación exitosa
 *       401:
 *         description: Código incorrecto
 */
router.post("/2fa/verify", preAuth, verify2FA);

/**
 * @swagger
 * /api/auth/2fa/status:
 *   post:
 *     summary: Verifica si el usuario autenticado tiene activado 2FA
 *     tags: [2FA]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Estado de 2FA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 twoFAEnabled:
 *                   type: boolean
 */
router.post("/2fa/status", preAuth, check2FAStatus);

/**
 * @swagger
 * /api/auth/2fa/reset:
 *   post:
 *     summary: Resetea el secreto de 2FA de un usuario (admin)
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
 *         description: 2FA reseteado exitosamente
 *       400:
 *         description: Email faltante
 *       500:
 *         description: Error en el servidor
 */

router.post("/2fa/reset", auth("admin"), reset2FA);

export default router;
