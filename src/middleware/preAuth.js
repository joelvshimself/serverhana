import jwt from 'jsonwebtoken';

export const preAuth = (req, res, next) => {
  const token = req.cookies?.PreAuth;

  if (!token) {
    return res.status(401).json({ message: "Falta token PreAuth" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.preAuth = decoded; // Guardamos el token decodificado para usarlo después si hace falta
    next();
  } catch (err) {
    console.error("Error en preAuth middleware:", err);
    return res.status(403).json({ message: "Token PreAuth inválido o expirado" });
  }
};
