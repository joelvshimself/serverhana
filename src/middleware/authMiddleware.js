import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Validamos que las variables existan para evitar errores
if (!process.env.SAP_IAS_JWKS_URI) {
  console.error("Falta la variable SAP_IAS_JWKS_URI en .env");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("Falta la variable JWT_SECRET en .env");
  process.exit(1);
}

// Cliente JWKS apuntando a SAP IAS
const client = jwksClient({
  jwksUri: process.env.SAP_IAS_JWKS_URI
});

// Función para obtener la clave pública desde SAP IAS
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
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

  // Si es token SAP, usamos JWKS
  jwt.verify(token, getKey, (err, decoded) => {
    if (err) {
      console.error("Token SAP IAS inválido:", err.message);
      return res.status(401).json({ message: "Token SAP IAS inválido" });
    }

    req.user = decoded;
    console.log("Token SAP IAS válido:", decoded);
    next();
  });
};
