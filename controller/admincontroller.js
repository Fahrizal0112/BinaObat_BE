const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { db } = require('../DBHandler');

const generateDoctorSignupToken = () => {
  return crypto.randomBytes(20).toString('hex');
};

const createDoctorSignupToken = (req, res) => {
  if (req.userRole !== 'Admin') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya admin yang dapat membuat token signup dokter.' });
  }

  const token = generateDoctorSignupToken();
  const query = 'INSERT INTO doctor_signup_tokens (token) VALUES (?)';

  db.query(query, [token], (err, result) => {
    if (err) {
      console.error('Error saat membuat token signup dokter:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan saat membuat token signup dokter' });
    }

    res.status(201).json({ message: 'Token signup dokter berhasil dibuat', token: token });
  });
};

const signupDoctor = async (req, res) => {
  const { fullname, email, password, phonenumber, token } = req.body;

  if (!fullname || !email || !password || !phonenumber || !token) {
    return res.status(400).json({ error: 'Semua field harus diisi' });
  }

  const verifyTokenQuery = 'SELECT * FROM doctor_signup_tokens WHERE token = ? AND is_used = FALSE';
  db.query(verifyTokenQuery, [token], async (verifyErr, verifyResults) => {
    if (verifyErr) {
      console.error('Error saat memverifikasi token:', verifyErr);
      return res.status(500).json({ error: 'Terjadi kesalahan saat memverifikasi token' });
    }

    if (verifyResults.length === 0) {
      return res.status(400).json({ error: 'Token tidak valid atau sudah digunakan' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const insertUserQuery = 'INSERT INTO users (fullname, email, password, phonenumber, role) VALUES (?, ?, ?, ?, "Doctor")';
      
      db.query(insertUserQuery, [fullname, email, hashedPassword, phonenumber], (insertErr, result) => {
        if (insertErr) {
          console.error('Error saat membuat user dokter:', insertErr);
          if (insertErr.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email atau nomor telepon sudah terdaftar' });
          }
          return res.status(500).json({ error: 'Terjadi kesalahan saat membuat user dokter' });
        }

        const updateTokenQuery = 'UPDATE doctor_signup_tokens SET is_used = TRUE WHERE token = ?';
        db.query(updateTokenQuery, [token], (updateErr) => {
          if (updateErr) {
            console.error('Error saat mengupdate status token:', updateErr);
          }
        });

        res.status(201).json({ message: 'Dokter berhasil didaftarkan', userId: result.insertId });
      });
    } catch (error) {
      console.error('Error tidak terduga:', error);
      res.status(500).json({ error: 'Terjadi kesalahan server internal' });
    }
  });
};

const createPatientByDoctor = async (req, res) => {
    const doctorId = req.userId; 
    const { fullname, email, password, phonenumber } = req.body;
  
    if (!fullname || !email || !password || !phonenumber) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const insertUserQuery = 'INSERT INTO users (fullname, email, password, phonenumber, role) VALUES (?, ?, ?, ?, "Patient")';
      
      db.query(insertUserQuery, [fullname, email, hashedPassword, phonenumber], (insertErr, result) => {
        if (insertErr) {
          console.error('Error saat membuat user pasien:', insertErr);
          if (insertErr.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email atau nomor telepon sudah terdaftar' });
          }
          return res.status(500).json({ error: 'Terjadi kesalahan saat membuat user pasien' });
        }
  
        const patientId = result.insertId;
        const patientToken = crypto.randomBytes(20).toString('hex');
  
        const insertPatientQuery = 'INSERT INTO patients (user_id, token) VALUES (?, ?)';
        db.query(insertPatientQuery, [patientId, patientToken], (patientErr, patientResult) => {
          if (patientErr) {
            console.error('Error saat membuat data pasien:', patientErr);
            return res.status(500).json({ error: 'Terjadi kesalahan saat membuat data pasien' });
          }
  
          const linkQuery = 'INSERT INTO doctor_patient_links (doctor_id, patient_id) VALUES (?, ?)';
          db.query(linkQuery, [doctorId, patientResult.insertId], (linkErr, linkResult) => {
            if (linkErr) {
              console.error('Error saat menghubungkan dokter dengan pasien:', linkErr);
              return res.status(500).json({ error: 'Terjadi kesalahan saat menghubungkan dokter dengan pasien' });
            }
  
            res.status(201).json({ 
              message: 'Pasien berhasil dibuat dan dihubungkan dengan dokter', 
              userId: patientId,
              patientToken: patientToken
            });
          });
        });
      });
    } catch (error) {
      console.error('Error tidak terduga:', error);
      res.status(500).json({ error: 'Terjadi kesalahan server internal' });
    }
  };

  const getPatients = (req, res) => {
    const doctorId = req.userId; // Diasumsikan dari middleware autentikasi
  
    const query = `
      SELECT 
        u.id as user_id,
        p.id as patient_id,
        u.fullname,
        u.email,
        u.phonenumber,
        p.token as patient_token
      FROM users u
      JOIN patients p ON u.id = p.user_id
      JOIN doctor_patient_links dpl ON p.id = dpl.patient_id
      WHERE dpl.doctor_id = ?
    `;
  
    db.query(query, [doctorId], (err, results) => {
      if (err) {
        console.error('Error saat mengambil daftar pasien:', err);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil daftar pasien' });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ message: 'Tidak ada pasien yang terhubung dengan dokter ini' });
      }
  
      const patients = results.map(result => ({
        userId: result.user_id,
        patientId: result.patient_id,
        fullname: result.fullname,
        email: result.email,
        phonenumber: result.phonenumber,
        patientToken: result.patient_token
      }));
  
      res.status(200).json({ patients: patients });
    });
  };

  const deletePatient = (req, res) => {
    const patientUserId = req.params.patientId;
    const doctorId = req.userId;
  

    const getPatientIdQuery = 'SELECT id FROM patients WHERE user_id = ?';
    db.query(getPatientIdQuery, [patientUserId], (err, patientResults) => {
      if (err) {
        console.error('Error saat mengambil ID pasien:', err);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data pasien' });
      }
  
      if (patientResults.length === 0) {
        return res.status(404).json({ error: 'Pasien tidak ditemukan' });
      }
  
      const patientId = patientResults[0].id;
  
      // Kemudian, hapus hubungan dokter-pasien
      const deleteQuery = 'DELETE FROM doctor_patient_links WHERE doctor_id = ? AND patient_id = ?';
      db.query(deleteQuery, [doctorId, patientId], (deleteErr, deleteResult) => {
        if (deleteErr) {
          console.error('Error saat menghapus hubungan dokter-pasien:', deleteErr);
          return res.status(500).json({ error: 'Terjadi kesalahan saat menghapus hubungan dokter-pasien' });
        }
  
        if (deleteResult.affectedRows === 0) {
          return res.status(404).json({ error: 'Hubungan dokter-pasien tidak ditemukan' });
        }
  
        res.status(200).json({ message: 'Hubungan dokter-pasien berhasil dihapus' });
      });
    });
  };

module.exports = { createDoctorSignupToken, signupDoctor, createPatientByDoctor, getPatients, deletePatient };