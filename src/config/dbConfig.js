import hana from "@sap/hana-client";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  serverNode: process.env.HANA_SERVER_NODE,
  uid: process.env.HANA_USER,
  pwd: process.env.HANA_PASSWORD,
  encrypt: process.env.DB_ENCRYPT === "true", 
  sslValidateCertificate: false 
};

const poolPromise = new Promise((resolve, reject) => {
  const conn = hana.createConnection();
  conn.connect(dbConfig, (err) => {
    if (err) {
      console.error("Error de conexión a SAP HANA:", err);
      reject(err);
    } else {
      console.log("Conectado a SAP HANA Cloud");
      resolve(conn);
    }
  });
});

export { hana, poolPromise };
