import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { poolPromise } from "../config/dbConfig.js";

export const generate2FA = async (req, res) => {
  const { email } = req.body;
  const conn = await poolPromise;

  // Generar el secreto
  const secret = speakeasy.generateSecret({ name: `ViBa (${email})` });

  // Guardar el secreto en SAP HANA
  const stmt = await conn.prepare(`
    UPDATE USUARIO SET "TWOFASECRET" = ? WHERE "EMAIL" = ?
  `);
  await stmt.exec([secret.base32, email]);

  // Generar QR para Google Authenticator
  const qr = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ qr });
};
export const verify2FA = async (req, res) => {
    const { email, token } = req.body;
    const conn = await poolPromise;
  
    // Obtener el secreto del usuario
    const stmt = await conn.prepare(`
      SELECT "TWOFASECRET" FROM USUARIO WHERE "EMAIL" = ?
    `);
    const result = await stmt.exec([email]);
  
    if (!result || result.length === 0 || !result[0].TWOFASECRET) {
      return res.status(400).json({ success: false, message: "2FA no activado" });
    }
  
    const verified = speakeasy.totp.verify({
      secret: result[0].TWOFASECRET,
      encoding: "base32",
      token,
      window: 1,
    });
  
    if (verified) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Código incorrecto" });
    }
  };
  export const check2FAStatus = async (req, res) => {
    const { email } = req.body;
    const conn = await poolPromise;
  
    const stmt = await conn.prepare(`
      SELECT "TWOFASECRET" FROM USUARIO WHERE "EMAIL" = ?
    `);
    const result = await stmt.exec([email]);
  
    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
  
    const isActive = !!result[0].TWOFASECRET;
    res.json({ twoFAEnabled: isActive });
  };
  