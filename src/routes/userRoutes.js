import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  loginUser,
  authStatus,
  getUserInfo,
  logoutUser
} from '../controllers/userController.js';

import { auth } from "../middleware/auth.js"

const router = express.Router();

/**
 * @swagger
 * /api/usuarios:
 *   get:
 *     summary: Obtener todos los usuarios
 *     description: Retorna una lista de todos los usuarios registrados.
 *     security:
 *       - BearerAuth: []  # Protegido por JWT
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   nombre:
 *                     type: string
 *                     example: Juan
 *                   email:
 *                     type: string
 *                     example: juan@ejemplo.com
 *                   rol:
 *                     type: string
 *                     example: admin
 */

router.get("/usuarios", auth("admin","developer","detallista","proveedor","owner"), getUsers);

/**
 * @swagger
 * /api/usuarios/{id}:
 *   get:
 *     summary: Obtener un usuario por ID
 *     description: Retorna un usuario especifico segun su ID.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario encontrado.
 *       404:
 *         description: Usuario no encontrado.
 */
router.get("/usuarios/:id", auth("admin","proveedor","detallista","developer", "owner"), getUserById);

/**
 * @swagger
 * /api/usuarios:
 *   post:
 *     summary: Crear un nuevo usuario
 *     description: Crea un usuario y almacena su contraseña de forma segura.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               rol:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente.
 */
router.post("/usuarios", auth("admin"), createUser);

/**
 * @swagger
 * /api/usuarios/{id}:
 *   put:
 *     summary: Actualizar un usuario
 *     description: Modifica los datos de un usuario existente.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               rol:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado correctamente.
 */
router.put("/usuarios/:id", auth("admin"), updateUser);

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Iniciar sesion
 *     description: Verifica las credenciales y devuelve un token si son correctas.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: J123@tec.mx
 *               password:
 *                 type: string
 *                 example: 123
 *     responses:
 *       200:
 *         description: Login exitoso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login exitoso
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     nombre:
 *                       type: string
 *                       example: Juan
 *                     email:
 *                       type: string
 *                       example: j@tec.mx
 *                     rol:
 *                       type: string
 *                       example: admin
 *       401:
 *         description: Credenciales incorrectas.
 *       500:
 *         description: Error del servidor.
 */
router.post('/login', loginUser);

/**
 * @swagger
 * /api/usuarios/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     description: Elimina un usuario existente por su ID.
 *     security:
 *       - BearerAuth: []  # Protegido por JWT
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del usuario a eliminar
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario eliminado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Usuario eliminado correctamente
 *       404:
 *         description: Usuario no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Usuario no encontrado
 *       401:
 *         description: No autorizado, token inválido o ausente.
 */

router.delete("/usuarios/:id", auth("admin", "developer"), deleteUser);

/**
 * @swagger
 * /api/check-auth:
 *   get:
 *     summary: Check authentication status
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Authentication status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authStatus:
 *                   type: string
 *                   enum: [authenticated, pre-2fa, none]
 *                   example: authenticated
 */
router.get("/check-auth", auth(), authStatus);

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Logout user
 *     tags:
 *       - Auth
 *     responses:
 *       '200':
 *         description: Session closed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sesión cerrada"
 */
router.post("/logout", logoutUser);

/**
 * @swagger
 * /api/user-info:
 *   get:
 *     summary: Get authenticated user's info
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Authenticated user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                   example: "user@example.com"
 *                 role:
 *                   type: string
 *                   example: "admin"
 *                 userId:
 *                   type: integer
 *                   example: 123
 *       '401':
 *         description: Unauthorized or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid token"
 */
router.get("/user-info", getUserInfo);

export default router;
