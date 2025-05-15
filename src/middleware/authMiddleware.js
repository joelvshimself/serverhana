import jwt from 'jsonwebtoken';

// Validamos que las variables existan para evitar errores

if (!process.env.JWT_SECRET) {
  console.error("Falta la variable JWT_SECRET en .env");
  process.exit(1);
}




export const authenticateToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(403).json({ message: "Acceso denegado, token requerido" });
  }

  const token = authHeader.replace("Bearer ", "");

  // Función para determinar si es token SAP o interno
  const isSapToken = (token) => {
    try {
      const decoded = jwt.decode(token, { complete: true });
      return !!decoded?.header?.kid; // Si tiene .kid, es SAP IAS
    } catch (e) {
      console.error("Error al decodificar el token:", e.message);
      return false;
    }
  };

  if (!isSapToken(token)) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log("Token interno válido:", decoded);
      return next();
    } catch (internalError) {
      console.error("Token interno inválido:", internalError.message);
      return res.status(401).json({ message: "Token interno inválido" });
    }
  }

};
