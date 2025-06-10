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
      sameSite: "None",
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

export const authStatus = async (req, res) => {
  try {
    const preAuth = req.cookies?.PreAuth;
    const auth = req.cookies?.Auth;

    if (auth) {
      jwt.verify(auth, process.env.JWT_SECRET);
      return res.json({ authStatus: "authenticated" });
    }

    if (preAuth) {
      const decoded = jwt.verify(preAuth, process.env.JWT_SECRET);
      if (decoded.step === "pre-2fa") {
        return res.json({ authStatus: "pre-2fa" });
      }
    }

    return res.json({ authStatus: "none" });

  } catch (err) {
    console.error("Error en authStatus:", err);
    return res.json({ authStatus: "none" });
  }
};

export const getUserInfo = (req, res) => {
  try {
    const token = req.cookies?.Auth;
    if(token){
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      return res.json({
        email: decoded.email,
        role: decoded.rol,
        userId: decoded.userId,
        twoFa: true
      });
    }
    const twofatoken = req.cookies?.PreAuth;
    if(twofatoken){
      const decoded = jwt.verify(twofatoken, process.env.JWT_SECRET);
      return res.json({
        email: decoded.email,
        role: decoded.rol,
        userId: decoded.userId,
        twoFa: false
      })
    }
    return res.status(401).json({ message: "No token" });

  } catch (err) {
    console.error("Error en getUserInfo:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const logoutUser = (req, res) => {
  res.clearCookie("Auth", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "None",
  });

  res.clearCookie("UserData", {
      httpOnly: false, // accesible by js
      sameSite: "None",
      secure: process.env.NODE_ENV === "production",
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


export const findUserById = async (id) => {
  const conn = await poolPromise;
  const stmt = await conn.prepare('SELECT * FROM Usuario WHERE "ID_USUARIO" = ?');
  const result = await stmt.exec([id]);

  return result?.[0] || null;
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

export const updateSelf = async (req, res) => {
  try {
    const token = req.cookies?.Auth;
    if (!token) return res.status(401).json({ message: "No autenticado" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const currentNombre = decoded.nombre;
    const currentEmail = decoded.email;
    const currentRole = decoded.rol;

    const { nombre, email, password } = req.body;
    const conn = await poolPromise;

    const fields = [];
    const values = [];

    if (nombre) {
      fields.push('nombre = ?');
      values.push(nombre);
    }

    if (email) {
      fields.push('email = ?');
      values.push(email);
    }

    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      fields.push('password = ?');
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
    }

    const query = `UPDATE Usuario SET ${fields.join(', ')} WHERE "ID_USUARIO" = ?`;
    values.push(userId);

    const updateStmt = await conn.prepare(query);
    await updateStmt.exec(values);

    // Use updated values or fallback to existing ones
    const updatedNombre = nombre || currentNombre;
    const updatedEmail = email || currentEmail;

    res.cookie("UserData", JSON.stringify({
      userId,
      email: updatedEmail,
      role: currentRole,
      nombre: updatedNombre
    }), {
      httpOnly: false,
      sameSite: "None",
      secure: process.env.NODE_ENV === "production",
      maxAge: 4 * 60 * 60 * 1000
    });

    res.json({ message: "Perfil actualizado correctamente" });

  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
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

