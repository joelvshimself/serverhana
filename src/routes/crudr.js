import express from 'express';
import { poolPromise } from '../config/dbConfig.js';


const crudr = express.Router();

/**
 * @swagger
 * tags:
 *   name: temporal
 *   description: Endpoints de prueba para Producto, Venta, DetalleVenta, Inventario y Notificacion
 */

// ==== Nueva Orden ====

/**
 * @swagger
 * /api/nuevaorden:
 *   post:
 *     summary: Crear una nueva orden entre usuarios
 *     tags: [temporal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               correo_solicita:
 *                 type: string
 *               correo_provee:
 *                 type: string
 *               fecha:
 *                 type: string
 *                 format: date
 *               productos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     producto:
 *                       type: string
 *                     cantidad:
 *                       type: integer
 *                     precio:
 *                       type: number
 *     responses:
 *       201:
 *         description: Orden creada exitosamente
 *       400:
 *         description: Error en los datos enviados
 *       500:
 *         description: Error interno al crear la orden
 */

crudr.post('/nuevaorden', async (req, res) => {
  const { correo_solicita, correo_provee, productos, fecha } = req.body;

  if (!correo_solicita || !correo_provee || !fecha || !Array.isArray(productos)) {
    return res.status(400).json({ error: 'Faltan campos necesarios: correo_solicita, correo_provee, productos o fecha' });
  }

  if (isNaN(Date.parse(fecha))) {
    return res.status(400).json({ error: 'La fecha proporcionada no es válida' });
  }

  let connection;

  try {
    connection = await poolPromise;

    const id_solicita = (await connection.exec(
      `SELECT id_usuario FROM Usuario WHERE LOWER(email) = LOWER(?)`, [correo_solicita]
    ))[0]?.ID_USUARIO;

    const id_provee = (await connection.exec(
      `SELECT id_usuario FROM Usuario WHERE LOWER(email) = LOWER(?)`, [correo_provee]
    ))[0]?.ID_USUARIO;

    if (!id_solicita || !id_provee) {
      return res.status(404).json({ error: 'Correo del solicitante o proveedor no encontrado' });
    }

    const crearOrdenResult = await connection.exec(`
      DO BEGIN
        DECLARE nueva_orden INT;
        CALL crearOrdenExtensa(?, ?, ?, nueva_orden);
        SELECT :nueva_orden AS ID_ORDEN_OUTPUT FROM DUMMY;
      END;
    `, [id_solicita, id_provee, fecha]);

    const nueva_orden = crearOrdenResult[0]?.ID_ORDEN_OUTPUT;
    if (!nueva_orden) return res.status(500).json({ error: 'No se obtuvo el ID de la orden' });

    for (const { producto: nombre_producto, cantidad, precio } of productos) {
      if (!nombre_producto || !cantidad || !precio) {
        return res.status(400).json({ error: 'Cada producto debe tener nombre, cantidad y precio' });
      }

      await connection.exec(
        `CALL agregarSuborden(?, ?, ?, ?, ?)`,
        [nueva_orden, nombre_producto, cantidad, precio, fecha]
      );
    }

    await connection.exec(
      `INSERT INTO Notificacion (mensaje, fecha, tipo, id_usuario) VALUES (?, ?, 'orden', ?)`,
      ['Tienes una nueva orden asignada', fecha, id_provee]
    );

    res.status(201).json({ message: 'Orden creada exitosamente', id_orden: nueva_orden });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Error interno al crear la orden', detail: error.message });
  }
});



/**
 * @swagger
 * /api/vender:
 *   post:
 *     summary: Realizar una venta de productos del inventario
 *     tags: [temporal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fecha:
 *                 type: string
 *                 format: date
 *               productos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     producto:
 *                       type: string
 *                     cantidad:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Venta realizada exitosamente
 *       400:
 *         description: Error de validación o inventario insuficiente
 *       500:
 *         description: Error interno
 */

crudr.post('/vender', async (req, res) => {
  const { productos, fecha } = req.body;
  if (!fecha || isNaN(Date.parse(fecha)) || !Array.isArray(productos)) {
    return res.status(400).json({ error: 'Se requiere una fecha válida y un array de productos.' });
  }

  let connection;
  let totalVenta = 0;
  const precios = { arrachera: 320, ribeye: 450, tomahawk: 600, diezmillo: 280 };
  const cantidades = { arrachera: 0, ribeye: 0, tomahawk: 0, diezmillo: 0 };

  for (const { producto, cantidad } of productos) {
    if (!producto || typeof cantidad !== 'number') {
      return res.status(400).json({ error: 'Cada producto debe tener nombre y cantidad numérica.' });
    }

    const nombre = producto.toLowerCase();
    if (!(nombre in precios)) {
      return res.status(400).json({ error: `Producto no reconocido: ${producto}` });
    }

    cantidades[nombre] += cantidad;
  }

  try {
    connection = await poolPromise;

    const inventarioOK = (await connection.exec(`
      SELECT resultado FROM puedoVenderInventario(?, ?, ?, ?)
    `, [cantidades.arrachera, cantidades.ribeye, cantidades.tomahawk, cantidades.diezmillo]))[0]?.RESULTADO;

    if (inventarioOK !== 1) {
      return res.status(400).json({ error: 'No hay suficiente inventario para completar la venta.' });
    }

    await connection.exec(`INSERT INTO Venta (fecha, total) VALUES (?, 0)`, [fecha]);

    const ventaResult = await connection.exec(`SELECT MAX(id_venta) AS id_venta FROM Venta`);
    const idVenta = ventaResult[0]?.ID_VENTA;

    if (!idVenta) return res.status(500).json({ error: 'No se pudo obtener ID de la venta' });

    for (const { producto, cantidad } of productos) {
      const nombre = producto.toLowerCase();
      const precioUnitario = precios[nombre];

      const inventario = await connection.exec(`
        SELECT id_inventario FROM Inventario
        WHERE producto = ? AND estado = 'disponible'
        ORDER BY fecha LIMIT ?
      `, [nombre, cantidad]);

      if (inventario.length < cantidad) {
        return res.status(400).json({ error: `Inventario insuficiente para ${nombre}` });
      }

      for (const { ID_INVENTARIO } of inventario) {
        await connection.exec(`
          INSERT INTO DetalleVenta (id_venta, id_inventario, costo_unitario)
          VALUES (?, ?, ?)
        `, [idVenta, ID_INVENTARIO, precioUnitario]);

        await connection.exec(`
          UPDATE Inventario
          SET estado = 'vendido',
              tipo_movimiento = 'salida por venta',
              observaciones = ?
          WHERE id_inventario = ?
        `, [`Vendido en venta #${idVenta}`, ID_INVENTARIO]);

        totalVenta += precioUnitario;
      }
    }

    await connection.exec(`UPDATE Venta SET total = ? WHERE id_venta = ?`, [totalVenta, idVenta]);

    res.status(201).json({ message: 'Venta realizada exitosamente.', id_venta: idVenta, total: totalVenta });

  } catch (error) {
    console.error('Error al vender:', error);
    res.status(500).json({ error: 'Error al procesar la venta', detail: error.message });
  }
});




/**
 * @swagger
 * /api/vender:
 *   post:
 *     summary: Realizar una venta de productos del inventario
 *     tags: [temporal]
 *     description: |
 *       Procesa la venta de productos disponibles en inventario.
 *       Valida la existencia de suficiente stock, registra la venta y actualiza el inventario como vendido.
 *       Productos soportados: arrachera, ribeye, tomahawk, diezmillo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     producto:
 *                       type: string
 *                       description: Nombre del producto (arrachera, ribeye, tomahawk, diezmillo)
 *                     cantidad:
 *                       type: integer
 *                       description: Número de unidades a vender
 *     responses:
 *       201:
 *         description: Venta realizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 id_venta:
 *                   type: integer
 *                 total:
 *                   type: number
 *       400:
 *         description: Error de validación o inventario insuficiente
 *       500:
 *         description: Error interno al procesar la venta
 */

crudr.post('/vender', async (req, res) => {
  const { productos, fecha } = req.body;
  let connection;

  if ( !fecha || !Array.isArray(productos) || isNaN(Date.parse(fecha)) ) {
    return res.status(400).json({ error: ' Se requiere fecha y un array de productos y cantidades.' });
  }

  // Inicializar cantidades
  let cant_arrachera = 0;
  let cant_ribeye = 0;
  let cant_tomahawk = 0;
  let cant_diezmillo = 0;

  // Contar cantidades por producto
  for (const item of productos) {
    const { producto, cantidad } = item;
    if (!producto || typeof cantidad !== 'number') {
      return res.status(400).json({ error: 'Cada producto debe tener nombre y cantidad numérica.' });
    }

    switch (producto.toLowerCase()) {
      case 'arrachera':
        cant_arrachera += cantidad;
        break;
      case 'ribeye':
        cant_ribeye += cantidad;
        break;
      case 'tomahawk':
        cant_tomahawk += cantidad;
        break;
      case 'diezmillo':
        cant_diezmillo += cantidad;
        break;
      default:
        return res.status(400).json({ error: `Producto no reconocido: ${producto}` });
    }
  }

  try {
    connection = await poolPromise;

    // 1. Validar si hay suficiente inventario
    const validarInventario = await connection.exec(`
      SELECT resultado FROM puedoVenderInventario(
        ${cant_arrachera}, ${cant_ribeye}, ${cant_tomahawk}, ${cant_diezmillo}
      )
    `);

    const inventarioDisponible = validarInventario[0]?.RESULTADO;

    if (inventarioDisponible !== 1) {
      return res.status(400).json({ error: 'No hay suficiente inventario para completar la venta.' });
    }

    // 2. Crear la venta
    await connection.exec(`
      INSERT INTO Venta (fecha, total)
      VALUES (?, 0
    `, [fecha]);

    // 3. Obtener ID de la venta recién creada
    const ventaResult = await connection.exec(`
      SELECT MAX(id_venta) AS id_venta FROM Venta
    `);

    const idVenta = ventaResult[0]?.ID_VENTA;

    if (!idVenta) {
      return res.status(500).json({ error: 'No se pudo crear la venta.' });
    }

    let totalVenta = 0;

    // 4. Para cada producto vendido
    for (const item of productos) {
      const { producto, cantidad } = item;

      // Seleccionar N productos disponibles de inventario
      const inventarioDisponible = await connection.exec(`
        SELECT id_inventario
        FROM Inventario
        WHERE producto = '${producto}' AND estado = 'disponible'
        ORDER BY fecha
        LIMIT ${cantidad}
      `);

      if (inventarioDisponible.length < cantidad) {
        return res.status(400).json({ error: `Inventario insuficiente para ${producto}` });
      }

      // 5. Insertar cada producto en DetalleVenta
      for (const inv of inventarioDisponible) {
        const idInventario = inv.ID_INVENTARIO;

        // Asumimos precio fijo para este ejemplo
        let precioUnitario = 0;
        switch (producto.toLowerCase()) {
          case 'arrachera': precioUnitario = 320; break;
          case 'ribeye': precioUnitario = 450; break;
          case 'tomahawk': precioUnitario = 600; break;
          case 'diezmillo': precioUnitario = 280; break;
        }

        await connection.exec(`
          INSERT INTO DetalleVenta (id_venta, id_inventario, costo_unitario)
          VALUES (${idVenta}, ${idInventario}, ${precioUnitario})
        `);

        // Actualizar inventario como vendido
        await connection.exec(`
          UPDATE Inventario
          SET estado = 'vendido',
              tipo_movimiento = 'salida por venta',
              observaciones = 'Vendido en venta #${idVenta}'
          WHERE id_inventario = ${idInventario}
        `);

        totalVenta += precioUnitario;
      }
    }

    // 6. Actualizar el total de la venta
    await connection.exec(`
      UPDATE Venta
      SET total = ${totalVenta}
      WHERE id_venta = ${idVenta}
    `);

    res.status(201).json({ message: 'Venta realizada exitosamente.', id_venta: idVenta, total: totalVenta });

  } catch (error) {
    console.error(' Error al vender:', error);
    res.status(500).json({ error: 'Error al procesar la venta', detail: error.message });
  }
});

/**
 * @swagger
 * /api/ventas:
 *   get:
 *     summary: Obtener todas las ventas con sus detalles
 *     tags: [temporal]
 *     responses:
 *       200:
 *         description: Lista de ventas
 */

crudr.get("/ventas", async (req, res) => {
  let connection;
  try {
    connection = await poolPromise;

    const ventas = await connection.exec(`
      SELECT V.id_venta, V.total, V.fecha, DV.id_inventario, DV.costo_unitario, I.producto
      FROM Venta V
      JOIN DetalleVenta DV ON V.id_venta = DV.id_venta
      JOIN Inventario I ON DV.id_inventario = I.id_inventario
      ORDER BY V.id_venta DESC
    `);

    const agrupadas = ventas.reduce((map, row) => {
      const id = row.ID_VENTA;
      if (!map[id]) {
        map[id] = {
          id: id,
          total: row.TOTAL,
          fecha: row.FECHA,
          productos: [],
        };
      }
      map[id].productos.push({
        nombre: row.PRODUCTO,
        costo_unitario: row.COSTO_UNITARIO
      });
      return map;
    }, {});

    res.status(200).json(Object.values(agrupadas));
  } catch (error) {
    console.error(" Error al obtener ventas:", error);
    res.status(500).json({ error: "Error al obtener ventas", detail: error.message });
  }
});
/**
 * @swagger
 * /api/ventas/{id}:
 *   delete:
 *     summary: Eliminar una venta específica
 *     tags: [temporal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Venta eliminada exitosamente
 *       404:
 *         description: Venta no encontrada
 *       500:
 *         description: Error interno del servidor
 */

crudr.delete("/ventas/:id", async (req, res) => {
  const ventaId = req.params.id;
  let connection;

  try {
    connection = await poolPromise;

    // Eliminar detalles primero (por restricción de FK)
    await connection.exec(`
      DELETE FROM DetalleVenta WHERE id_venta = ${ventaId}
    `);

    // Luego eliminar venta
    const result = await connection.exec(`
      DELETE FROM Venta WHERE id_venta = ${ventaId}
    `);

    print(result);

    res.status(200).json({ message: `Venta ${ventaId} eliminada exitosamente` });

  } catch (error) {
    console.error(' Error al eliminar venta:', error);
    res.status(500).json({ error: 'Error al eliminar venta', detail: error.message });
  }
});
/**
 * @swagger
 * /api/ventas/{id}:
 *   put:
 *     summary: Editar una venta (productos y costos)
 *     tags: [temporal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nombre:
 *                       type: string
 *                     cantidad:
 *                       type: integer
 *                     costo_unitario:
 *                       type: number
 *     responses:
 *       200:
 *         description: Venta actualizada
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */

crudr.put("/ventas/:id", async (req, res) => {
  const ventaId = req.params.id;
  const { productos } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: "Se requiere una lista de productos" });
  }

  let connection;

  try {
    connection = await poolPromise;

    // 1. Eliminar productos existentes de esa venta
    await connection.exec(`
      DELETE FROM DetalleVenta WHERE id_venta = ${ventaId}
    `);

    // 2. Insertar nuevos productos con su costo
    let total = 0;

    for (const p of productos) {
      const { nombre, cantidad, costo_unitario } = p;

      const inventario = await connection.exec(`
        SELECT id_inventario
        FROM Inventario
        WHERE producto = '${nombre}' AND estado = 'vendido'
        AND TO_VARCHAR(observaciones) = 'Vendido en venta #${ventaId}'
        ORDER BY fecha
        LIMIT ${cantidad}
      `);
      

      if (inventario.length < cantidad) {
        return res.status(400).json({ error: `No hay suficientes unidades de ${nombre} vendidas en esta venta.` });
      }

      for (let i = 0; i < cantidad; i++) {
        const inv = inventario[i];
        await connection.exec(`
          INSERT INTO DetalleVenta (id_venta, id_inventario, costo_unitario)
          VALUES (${ventaId}, ${inv.ID_INVENTARIO}, ${costo_unitario})
        `);
        total += costo_unitario;
      }
    }

    // 3. Actualizar total en tabla Venta
    await connection.exec(`
      UPDATE Venta SET total = ${total} WHERE id_venta = ${ventaId}
    `);

    res.status(200).json({ message: `Venta ${ventaId} actualizada`, total });

  } catch (error) {
    console.error(" Error al actualizar venta:", error);
    res.status(500).json({ error: "Error al actualizar venta", detail: error.message });
  }
});
/**
 * @swagger
 * /api/ordenes:
 *   get:
 *     summary: Obtener todas las órdenes con detalles completos
 *     tags: [temporal]
 *     responses:
 *       200:
 *         description: Lista de órdenes
 */
crudr.get("/ordenes", async (req, res) => {
  try {
    const connection = await poolPromise;

    const result = await connection.exec(`
      SELECT
        ID_ORDEN,
        FECHA_EMISION,
        FECHA_RECEPCION,
        FECHA_RECEPCION_ESTIMADA,
        ESTADO,
        SUBTOTAL,
        COSTO_COMPRA,
        ID_USUARIO_SOLICITA,
        ID_USUARIO_PROVEE
      FROM ORDEN
      ORDER BY ID_ORDEN DESC
    `);

    res.status(200).json(result);

  } catch (error) {
    console.error(" Error al obtener órdenes:", error);
    res.status(500).json({ error: "Error al obtener órdenes", detail: error.message });
  }
});

crudr.delete("/ordenes/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const connection = await poolPromise;

    await connection.exec(`DELETE FROM SUBORDEN WHERE ID_ORDEN = ${id}`);

    await connection.exec(`DELETE FROM ORDEN WHERE ID_ORDEN = ${id}`);

    res.status(200).json({ message: "Orden y subórdenes eliminadas correctamente" });
  } catch (error) {
    console.error("Error al eliminar orden:", error);
    res.status(500).json({ error: "Error al eliminar orden", detail: error.message });
  }
});


crudr.put("/ordenes/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const {
      estado,
      fecha_emision,
      fecha_recepcion,
      fecha_estimada,
      subtotal,
      costo,
      usuario_solicita,
      usuario_provee
    } = req.body;

    const connection = await poolPromise;

    const safeValue = (value) => value ? `'${value}'` : 'NULL';

    await connection.exec(`
      UPDATE ORDEN SET
        ESTADO = ${safeValue(estado)},
        FECHA_EMISION = ${safeValue(fecha_emision)},
        FECHA_RECEPCION = ${safeValue(fecha_recepcion)},
        FECHA_RECEPCION_ESTIMADA = ${safeValue(fecha_estimada)},
        SUBTOTAL = ${subtotal || 0},
        COSTO_COMPRA = ${costo || 0},
        ID_USUARIO_SOLICITA = ${safeValue(usuario_solicita)},
        ID_USUARIO_PROVEE = ${safeValue(usuario_provee)}
      WHERE ID_ORDEN = ${id}
    `);
    

    res.status(200).json({ message: "Orden actualizada" });
  } catch (error) {
    console.error(" Error al actualizar orden:", error);
    res.status(500).json({ error: "Error al actualizar orden", detail: error.message });
  }
});

/**
 * @swagger
 * /api/notificaciones:
 *   post:
 *     summary: Crear una nueva notificación
 *     tags: [temporal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mensaje
 *               - tipo
 *             properties:
 *               mensaje:
 *                 type: string
 *                 example: Tienes una nueva orden asignada
 *               tipo:
 *                 type: string
 *                 example: orden
 *     responses:
 *       201:
 *         description: Notificación creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notificación creada correctamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @swagger
 * /api/notificaciones:
 *   get:
 *     summary: Obtener todas las notificaciones
 *     tags: [temporal]
 *     responses:
 *       200:
 *         description: Lista de notificaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_notificacion:
 *                     type: integer
 *                   mensaje:
 *                     type: string
 *                   tipo:
 *                     type: string
 *                   fecha:
 *                     type: string
 *                     format: date
 *                   id_usuario:
 *                     type: integer
 *       500:
 *         description: Error al obtener notificaciones
 */
// ==== NOTIFICACIONES ====

// POST: Crear una nueva notificación
crudr.post('/notificaciones', async (req, res) => {
  const { mensaje, tipo, id_usuario } = req.body;
  let connection;

  if (!mensaje || !tipo) {
    return res.status(400).json({ error: 'Se requieren los campos: mensaje y tipo.' });
  }

  try {
    connection = await poolPromise;

    await connection.exec(`
      INSERT INTO Notificacion (mensaje, tipo, fecha${id_usuario ? ', id_usuario' : ''})
      VALUES ('${mensaje}', '${tipo}', CURRENT_DATE${id_usuario ? `, ${id_usuario}` : ''})
    `);

    res.status(201).json({ message: 'Notificación creada correctamente' });

  } catch (error) {
    console.error('Error al crear notificación:', error);
    res.status(500).json({ error: 'Error al crear notificación', detail: error.message });
  }
});

// GET: Obtener todas las notificaciones
crudr.get('/notificaciones', async (req, res) => {
  let connection;

  try {
    connection = await poolPromise;

    const notificaciones = await connection.exec(`
      SELECT id_notificacion, mensaje, tipo, id_usuario
      FROM Notificacion
      ORDER BY id_usuario DESC
    `);

    res.status(200).json(notificaciones);

  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones', detail: error.message });
  }
});






export default crudr;
