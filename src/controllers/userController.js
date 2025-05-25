import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { poolPromise } from "../config/dbConfig.js";

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email y contraseña son obligatorios" });

    const conn = await poolPromise;
    const stmt = await conn.prepare('SELECT * FROM USUARIO WHERE "EMAIL" = ?');
    const result = await stmt.exec([email]);

    if (!result || result.length === 0)
      return res.status(401).json({ message: "Credenciales incorrectas" });

    const user = result[0];
    const isMatch = await bcrypt.compare(password, user.PASSWORD);
    if (!isMatch)
      return res.status(401).json({ message: "Credenciales incorrectas" });

    const has2FA = !!user.TWOFASECRET;

    const tempToken = jwt.sign(
      {
        userId: user.ID,
        email: user.EMAIL,
        rol: user.ROL,
        twoFAEnabled: has2FA,
        step: "pre-2fa"
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("PreAuth", tempToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({
      message: "Credenciales válidas, esperando verificación 2FA",
      twoFAEnabled: has2FA
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ message: "Error en el servidor al procesar login" });
  }
};

export const checkAuth = (req, res) => {
  const token = req.cookies?.Auth;

  if (!token) {
    return res.status(401).json({ message: "No autenticado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ authenticated: true, user: decoded });
  } catch (error) {
    console.error("Token inválido:", error);
    res.status(401).json({ message: "Token inválido o expirado" });
  }
};

export const logoutUser = (req, res) => {
  res.clearCookie("Auth", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
  });

  res.status(200).json({ message: "Sesión cerrada" });
};

export const getUsers = async (req, res) => {
  try {
    const conn = await poolPromise;
    const stmt = await conn.prepare('SELECT * FROM Usuario');
    const result = await stmt.exec(); // devuelve un arreglo de usuarios

    res.json(result); // Envia todos los usuarios correctamente
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Obtener usuario por ID

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await poolPromise;

    const stmt = await conn.prepare('SELECT * FROM Usuario WHERE id = ?');
    const result = await stmt.exec([id]);

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(result[0]); // Devuelve el primer usuario encontrado
  } catch (error) {
    console.error("Error en getUserById:", error);
    res.status(500).json({ message: error.message });
  }
};


// Crear usuario
export const createUser = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!password) return res.status(400).json({ message: "La contraseña es obligatoria" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const pool = await poolPromise;
    await pool.exec(
      'INSERT INTO Usuario (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, hashedPassword, rol]
    );

    res.status(201).json({ message: "Usuario creado exitosamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




// Actualizar usuario
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, password, rol } = req.body;

    const conn = await poolPromise;

    // Verificar si el usuario existe
    const checkStmt = await conn.prepare('SELECT * FROM Usuario WHERE "ID_USUARIO" = ?');
    const result = await checkStmt.exec([id]);

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const existingUser = result[0];

    // Hashear la contraseña solo si viene una nueva
    let hashedPassword = existingUser.PASSWORD;
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    // Ejecutar UPDATE
    const updateStmt = await conn.prepare(`
      UPDATE Usuario SET 
        nombre = ?, 
        email = ?, 
        password = ?, 
        rol = ? 
      WHERE "ID_USUARIO" = ?
    `);
    

    await updateStmt.exec([nombre, email, hashedPassword, rol, id]);

    res.json({ message: "Usuario actualizado correctamente" });

  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ message: error.message });
  }
};


// Eliminar usuario
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await poolPromise;

    // Verificar si el usuario existe
    const checkStmt = await conn.prepare('SELECT * FROM Usuario WHERE "ID_USUARIO" = ?');
    const result = await checkStmt.exec([id]);

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Eliminar usuario
    const deleteStmt = await conn.prepare('DELETE FROM Usuario WHERE "ID_USUARIO" = ?');
    await deleteStmt.exec([id]);

    res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ message: error.message });
  }
};

