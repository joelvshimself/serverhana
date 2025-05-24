import jwt from 'jsonwebtoken';

export const auth = (...allowedRoles) => {
  return (req, res, next) => {
    const token = req.cookies.Auth;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // If specific roles are required
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.rol)) {
        return res.status(403).json({ message: "No tienes permisos suficientes" });
      }

      next();
    } catch (error) {
      return res.status(403).json({ message: "Token inválido o expirado" });
    }
  };
};

