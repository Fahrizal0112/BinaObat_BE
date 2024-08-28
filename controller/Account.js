const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../DBHandler');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const COOKIE_MAX_AGE = process.env.COOKIE_MAX_AGE || 3600000; 

const generatePatientToken = () => {
  return crypto.randomBytes(20).toString('hex');
};

const signup = async (req, res) => {
  const { fullname, email, password, phonenumber, role } = req.body;

  if (!fullname || !email || !password || !phonenumber || !role) {
    return res.status(400).json({ error: 'Semua field harus diisi' });
  }

  try {
    const checkDuplicateQuery = 'SELECT * FROM users WHERE email = ? OR phonenumber = ?';
    db.query(checkDuplicateQuery, [email, phonenumber], async (checkErr, checkResults) => {
      if (checkErr) {
        console.error('Error saat memeriksa duplikat:', checkErr);
        return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa data', details: checkErr.message });
      }

      if (checkResults.length > 0) {
        const duplicateField = checkResults[0].email === email ? 'Email' : 'Nomor telepon';
        return res.status(400).json({ error: `${duplicateField} sudah terdaftar` });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const insertUserQuery = 'INSERT INTO users (fullname, email, password, phonenumber, role) VALUES (?, ?, ?, ?, ?)';
      
      db.query(insertUserQuery, [fullname, email, hashedPassword, phonenumber, role], (insertErr, result) => {
        if (insertErr) {
          console.error('Error saat membuat user:', insertErr);
          return res.status(500).json({ error: 'Terjadi kesalahan saat membuat user', details: insertErr.message });
        }

        const userId = result.insertId;

        if (role === 'Patient') {
          const patientToken = generatePatientToken();
          const insertPatientQuery = 'INSERT INTO patients (user_id, token) VALUES (?, ?)';
          
          db.query(insertPatientQuery, [userId, patientToken], (patientErr, patientResult) => {
            if (patientErr) {
              console.error('Error saat membuat data pasien:', patientErr);
              return res.status(500).json({ error: 'Terjadi kesalahan saat membuat data pasien', details: patientErr.message });
            }
            
            res.status(201).json({ 
              message: 'User dan data pasien berhasil dibuat', 
              userId: userId,
              patientToken: patientToken 
            });
          });
        } else {
          res.status(201).json({ message: 'User berhasil dibuat', userId: userId });
        }
      });
    });
  } catch (error) {
    console.error('Error tidak terduga:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server internal', details: error.message });
  }
};

  

const signin = (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Error during sign-in' });
    } else if (results.length === 0) {
      res.status(401).json({ error: 'Email Not Registered' });
    } else {
      const user = results[0];
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (passwordMatch) {
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: parseInt(COOKIE_MAX_AGE) 
        });

        delete user.password;

        res.json({ message: 'Signed in successfully', user: user });
      } else {
        res.status(401).json({ error: 'Wrong Password' });
      }
    }
  });
};

const getUser = async (req, res) => {
    try {
      const userId = req.userId;
  
      const query = 'SELECT fullname,role FROM users WHERE id = ?';
      db.query(query, [userId], (err, results) => {
        if (err || results.length === 0) {
          return res.status(404).json({ message: "User not found!" });
        }
  
        res.json({ fullname: results[0].fullname, role: results[0].role });
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

const linkDoctorToPatient = async (req, res) => {
  const doctorId = req.userId; 
  const { patientToken } = req.body;

  try {
    const checkDoctorQuery = 'SELECT role FROM users WHERE id = ?';
    db.query(checkDoctorQuery, [doctorId], (doctorErr, doctorResults) => {
      if (doctorErr) {
        console.error('Error saat memeriksa peran dokter:', doctorErr);
        return res.status(500).json({ error: 'Kesalahan saat memeriksa peran pengguna' });
      }

      if (doctorResults.length === 0 || doctorResults[0].role !== 'Doctor') {
        return res.status(403).json({ error: 'Akses ditolak. Hanya dokter yang dapat menghubungkan dengan pasien' });
      }

      const checkTokenQuery = 'SELECT id FROM patients WHERE token = ?';
      db.query(checkTokenQuery, [patientToken], (checkErr, checkResults) => {
        if (checkErr) {
          console.error('Error saat memeriksa token pasien:', checkErr);
          return res.status(500).json({ error: 'Kesalahan saat memeriksa token pasien' });
        }

        if (checkResults.length === 0) {
          return res.status(400).json({ error: 'Token pasien tidak valid' });
        }

        const patientId = checkResults[0].id;
        const checkLinkQuery = 'SELECT * FROM doctor_patient_links WHERE doctor_id = ? AND patient_id = ?';
        db.query(checkLinkQuery, [doctorId, patientId], (linkCheckErr, linkCheckResults) => {
          if (linkCheckErr) {
            console.error('Error saat memeriksa hubungan dokter-pasien:', linkCheckErr);
            return res.status(500).json({ error: 'Kesalahan saat memeriksa hubungan dokter-pasien' });
          }

          if (linkCheckResults.length > 0) {
            return res.status(400).json({ error: 'Hubungan dokter-pasien sudah ada' });
          }

          const linkQuery = 'INSERT INTO doctor_patient_links (doctor_id, patient_id) VALUES (?, ?)';
          db.query(linkQuery, [doctorId, patientId], (linkErr, linkResult) => {
            if (linkErr) {
              console.error('Error saat menghubungkan dokter dengan pasien:', linkErr);
              return res.status(500).json({ error: 'Kesalahan saat menghubungkan dokter dengan pasien' });
            }

            res.status(200).json({ message: 'Dokter berhasil dihubungkan dengan pasien' });
          });
        });
      });
    });
  } catch (error) {
    console.error('Kesalahan server internal:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
};


const signout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Signed out successfully' });
};

module.exports={ signup, signin, signout, getUser, linkDoctorToPatient };
