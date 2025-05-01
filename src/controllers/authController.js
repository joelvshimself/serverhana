import jwt from 'jsonwebtoken';
import { getUserByEmail } from '../services/dbServices.js'; 

export async function verifyToken(req, res) {
  const authHeader = req.header('Authorization');
  console.log('🔍 Token recibido en /auth/verify:', authHeader);

  if (!authHeader) {
    return res.status(400).json({ success: false, message: 'Token no proporcionado' });
  }

  const token = authHeader.replace('Bearer ', '');

  jwt.verify(token, process.env.SESSION_SECRET, async (err, decoded) => {
    if (err) {
      console.error('Error al verificar token interno:', err);
      return res.status(401).json({ success: false, message: 'Token inválido' });
    }

    console.log('Token interno decodificado:', decoded);

    try {
      const user = await getUserByEmail(decoded.email);

      if (!user) {
        console.warn('Usuario no encontrado en la base de datos local:', decoded.email);
        return res.status(403).json({ success: false, message: 'Usuario no registrado en base de datos' });
      }

      return res.status(200).json({ success: true, user });
    } catch (error) {
      console.error('Error al consultar la base de datos:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  });
}
