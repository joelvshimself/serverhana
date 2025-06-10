import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { poolPromise } from "../config/dbConfig.js";
import jwt from 'jsonwebtoken';

export const generate2FA = async (req, res) => {
  try {
    const { email } = req.preAuth;

    if (!email)
      return res.status(400).json({ message: "Token inválido: falta email" });

    const conn = await poolPromise;

    const secret = speakeasy.generateSecret({ name: `ViBa (${email})` });

    const stmt = await conn.prepare(`
      UPDATE USUARIO SET "TWOFASECRET" = ? WHERE "EMAIL" = ?
    `);
    await stmt.exec([secret.base32, email]);

    const qr = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ qr, otpauth_url: secret.otpauth_url });

  } catch (err) {
    console.error("Error en generate2FA:", err);
    res.status(500).json({ message: "Error generando 2FA" });
  }
};


export const verify2FA = async (req, res) => {
  try {
    const decoded = req.preAuth;

    if (decoded.step !== "pre-2fa")
      return res.status(401).json({ message: "Token inválido para 2FA" });

    const { token } = req.body; 
    if (!token)
      return res.status(400).json({ message: "Falta código 2FA" });

    const conn = await poolPromise;
    const stmt = await conn.prepare(`SELECT * FROM USUARIO WHERE "EMAIL" = ?`);
    const result = await stmt.exec([decoded.email]);

    if (!result || result.length === 0)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const user = result[0];
    const verified = speakeasy.totp.verify({
      secret: user.TWOFASECRET,
      encoding: "base32",
      token,
      window: 1
    });

    if (!verified)
      return res.status(401).json({ message: "Código 2FA inválido" });

    const finalToken = jwt.sign(
      { userId: user.ID_USUARIO, email: user.EMAIL, rol: user.ROL, nombre: user.NOMBRE },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie("PreAuth");
    res.cookie("Auth", finalToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "None" : "Lax",
      maxAge: 4 * 60 * 60 * 1000
    });

    res.cookie("UserData", JSON.stringify({
      userId: user.ID_USUARIO,
      email: user.EMAIL,
      role: user.ROL,
      nombre: user.NOMBRE
    }), {
      httpOnly: false, // accesible by js
      secure: isProd,
      sameSite: isProd ? "None" : "Lax",
      maxAge: 4 * 60 * 60 * 1000 
    });
    
    console.log("ambiente:",process.env.NODE_ENV)
    console.log(process.env.NODE_ENV === "production")
    res.json({ message: "2FA exitoso", success: true });

  } catch (err) {
    console.error("Error en verify2FA:", err);
    res.status(500).json({ message: "Error al verificar 2FA" });
  }
}; 

  export const check2FAStatus = async (req, res) => {
    const decoded = req.preAuth;

    const result = decoded.twoFAEnabled
  
    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
  
    res.json({ twoFAEnabled: result });
  };

export const reset2FA = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email es requerido" });

    const conn = await poolPromise;
    const stmt = await conn.prepare(`
      UPDATE USUARIO SET "TWOFASECRET" = NULL WHERE "EMAIL" = ?
    `);
    await stmt.exec([email]);

    res.json({ message: `2FA reseteado para ${email}` });
  } catch (error) {
    console.error("Error en reset2FA:", error);
    res.status(500).json({ message: "Error al resetear 2FA" });
  }
};
