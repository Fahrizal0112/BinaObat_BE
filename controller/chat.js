const { db } = require('../DBHandler');

// Fungsi untuk mengirim pesan
const sendMessage = (req, res) => {
  const senderId = req.userId;
  const senderRole = req.userRole;
  const { receiverId, message } = req.body;

  if (!receiverId || !message) {
    return res.status(400).json({ error: 'ID penerima dan pesan harus diisi' });
  }

  let checkRelationQuery;
  let queryParams;

  if (senderRole === 'Doctor') {
    checkRelationQuery = `
      SELECT * FROM doctor_patient_links 
      WHERE doctor_id = ? AND patient_id = ?
    `;
    queryParams = [senderId, receiverId];
  } else if (senderRole === 'Patient') {
    checkRelationQuery = `
      SELECT * FROM doctor_patient_links 
      WHERE doctor_id = ? AND patient_id = (SELECT id FROM patients WHERE user_id = ?)
    `;
    queryParams = [receiverId, senderId];
  } else {
    return res.status(403).json({ error: 'Peran pengguna tidak valid' });
  }

  db.query(checkRelationQuery, queryParams, (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Error saat memeriksa hubungan:', checkErr);
      return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa hubungan' });
    }

    if (checkResults.length === 0) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin untuk mengirim pesan ke pengguna ini' });
    }

    let insertMessageQuery;
    let insertParams;

    if (senderRole === 'Doctor') {
      insertMessageQuery = `
        INSERT INTO chat_messages (sender_id, receiver_id, message, sent_at)
        VALUES (?, (SELECT user_id FROM patients WHERE id = ?), ?, NOW())
      `;
      insertParams = [senderId, receiverId, message];
    } else {
      insertMessageQuery = `
        INSERT INTO chat_messages (sender_id, receiver_id, message, sent_at)
        VALUES ((SELECT user_id FROM patients WHERE id = (SELECT id FROM patients WHERE user_id = ?)), ?, ?, NOW())
      `;
      insertParams = [senderId, receiverId, message];
    }

    db.query(insertMessageQuery, insertParams, (insertErr, insertResult) => {
      if (insertErr) {
        console.error('Error saat mengirim pesan:', insertErr);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengirim pesan' });
      }

      res.status(201).json({ message: 'Pesan berhasil dikirim', messageId: insertResult.insertId });
    });
  });
};

// Fungsi untuk mengambil riwayat chat
const getChatHistory = (req, res) => {
  const userId = req.userId;
  const { partnerId } = req.params;
  const userRole = req.userRole;

  let checkRelationQuery;
  let queryParams;

  if (userRole === 'Doctor') {
    checkRelationQuery = `
      SELECT * FROM doctor_patient_links 
      WHERE doctor_id = ? AND patient_id = ?
    `;
    queryParams = [userId, partnerId];
  } else if (userRole === 'Patient') {
    checkRelationQuery = `
      SELECT * FROM doctor_patient_links 
      WHERE doctor_id = ? AND patient_id = (SELECT id FROM patients WHERE user_id = ?)
    `;
    queryParams = [partnerId, userId];
  } else {
    return res.status(403).json({ error: 'Peran pengguna tidak valid' });
  }

  db.query(checkRelationQuery, queryParams, (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Error saat memeriksa hubungan:', checkErr);
      return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa hubungan' });
    }

    if (checkResults.length === 0) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin untuk melihat riwayat chat dengan pengguna ini' });
    }

    let getChatHistoryQuery;
    let historyParams;

    if (userRole === 'Doctor') {
      getChatHistoryQuery = `
        SELECT cm.id, cm.sender_id, cm.receiver_id, cm.message, cm.sent_at,
               CASE 
                 WHEN cm.sender_id = ? THEN 'Doctor'
                 ELSE 'Patient'
               END as sender_role,
               u_sender.fullname as sender_name, u_receiver.fullname as receiver_name
        FROM chat_messages cm
        JOIN users u_sender ON cm.sender_id = u_sender.id
        JOIN users u_receiver ON cm.receiver_id = u_receiver.id
        WHERE (cm.sender_id = ? AND cm.receiver_id = (SELECT user_id FROM patients WHERE id = ?))
           OR (cm.sender_id = (SELECT user_id FROM patients WHERE id = ?) AND cm.receiver_id = ?)
        ORDER BY cm.sent_at ASC
      `;
      historyParams = [userId, userId, partnerId, partnerId, userId];
    } else {
      getChatHistoryQuery = `
        SELECT cm.id, cm.sender_id, cm.receiver_id, cm.message, cm.sent_at,
               CASE 
                 WHEN cm.sender_id = (SELECT user_id FROM patients WHERE id = (SELECT id FROM patients WHERE user_id = ?)) THEN 'Patient'
                 ELSE 'Doctor'
               END as sender_role,
               u_sender.fullname as sender_name, u_receiver.fullname as receiver_name
        FROM chat_messages cm
        JOIN users u_sender ON cm.sender_id = u_sender.id
        JOIN users u_receiver ON cm.receiver_id = u_receiver.id
        WHERE (cm.sender_id = (SELECT user_id FROM patients WHERE id = (SELECT id FROM patients WHERE user_id = ?)) AND cm.receiver_id = ?)
           OR (cm.sender_id = ? AND cm.receiver_id = (SELECT user_id FROM patients WHERE id = (SELECT id FROM patients WHERE user_id = ?)))
        ORDER BY cm.sent_at ASC
      `;
      historyParams = [userId, userId, partnerId, partnerId, userId];
    }

    db.query(getChatHistoryQuery, historyParams, (historyErr, historyResults) => {
      if (historyErr) {
        console.error('Error saat mengambil riwayat chat:', historyErr);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil riwayat chat' });
      }

      res.status(200).json({ chatHistory: historyResults });
    });
  });
};

const getChatPartners = (req, res) => {
  const userId = req.userId;
  const userRole = req.userRole;

  let query;
  if (userRole === 'Doctor') {
    query = `
      SELECT p.id as patient_id, u.fullname as patient_name
      FROM patients p
      JOIN users u ON p.user_id = u.id
      JOIN doctor_patient_links dpl ON p.id = dpl.patient_id
      WHERE dpl.doctor_id = ?
    `;
  } else if (userRole === 'Patient') {
    query = `
      SELECT dpl.doctor_id, u.fullname as doctor_name
      FROM doctor_patient_links dpl
      JOIN users u ON dpl.doctor_id = u.id
      JOIN patients p ON dpl.patient_id = p.id
      WHERE p.user_id = ?
    `;
  } else {
    return res.status(403).json({ error: 'Peran pengguna tidak valid' });
  }

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error saat mengambil daftar chat partners:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil daftar chat partners' });
    }

    res.status(200).json({ chatPartners: results });
  });
};

module.exports = { sendMessage, getChatHistory, getChatPartners };
