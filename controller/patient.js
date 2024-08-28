const { db } = require('../DBHandler');

const prescribeMedication = (req, res) => {
  const doctorId = req.userId; 
  const { patientId, medications } = req.body;

  if (!patientId || !medications || !Array.isArray(medications) || medications.length === 0) {
    return res.status(400).json({ error: 'Data tidak lengkap atau tidak valid' });
  }

  const checkRelationQuery = 'SELECT * FROM doctor_patient_links WHERE doctor_id = ? AND patient_id = ?';
  db.query(checkRelationQuery, [doctorId, patientId], (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Error saat memeriksa hubungan dokter-pasien:', checkErr);
      return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa hubungan dokter-pasien' });
    }

    if (checkResults.length === 0) {
      return res.status(403).json({ error: 'Anda tidak berhak meresepkan obat untuk pasien ini' });
    }

    const insertPrescriptionQuery = 'INSERT INTO prescriptions (doctor_id, patient_id, created_at) VALUES (?, ?, NOW())';
    db.query(insertPrescriptionQuery, [doctorId, patientId], (prescErr, prescResult) => {
      if (prescErr) {
        console.error('Error saat membuat resep:', prescErr);
        return res.status(500).json({ error: 'Terjadi kesalahan saat membuat resep' });
      }

      const prescriptionId = prescResult.insertId;

      const insertMedicationQuery = 'INSERT INTO prescription_medications (prescription_id, medication_name, dosage, frequency) VALUES ?';
      const medicationValues = medications.map(med => [prescriptionId, med.name, med.dosage, med.frequency]);

      db.query(insertMedicationQuery, [medicationValues], (medErr, medResult) => {
        if (medErr) {
          console.error('Error saat menambahkan detail obat:', medErr);
          return res.status(500).json({ error: 'Terjadi kesalahan saat menambahkan detail obat' });
        }

        res.status(201).json({ 
          message: 'Resep obat berhasil ditambahkan', 
          prescriptionId: prescriptionId,
          medicationsAdded: medResult.affectedRows
        });
      });
    });
  });
};

const getPatientPrescriptions = (req, res) => {
  const patientId = req.params.patientId;
  const doctorId = req.userId; 

  const checkRelationQuery = 'SELECT * FROM doctor_patient_links WHERE doctor_id = ? AND patient_id = ?';
  db.query(checkRelationQuery, [doctorId, patientId], (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Error saat memeriksa hubungan dokter-pasien:', checkErr);
      return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa hubungan dokter-pasien' });
    }

    if (checkResults.length === 0) {
      return res.status(403).json({ error: 'Anda tidak berhak melihat resep untuk pasien ini' });
    }

    const getPrescriptionsQuery = `
      SELECT p.id, p.created_at, u.fullname as doctor_name
      FROM prescriptions p
      JOIN users u ON p.doctor_id = u.id
      WHERE p.patient_id = ?
      ORDER BY p.created_at DESC
    `;

    db.query(getPrescriptionsQuery, [patientId], (err, results) => {
      if (err) {
        console.error('Error saat mengambil resep:', err);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil resep' });
      }

      res.status(200).json({ prescriptions: results });
    });
  });
};

const getPrescriptionDetails = (req, res) => {
    const prescriptionId = req.params.prescriptionId;
    const userId = req.userId; 
    const userRole = req.userRole;
  
    let checkPermissionQuery;
    let queryParams;
  
    if (userRole === 'Doctor') {
      checkPermissionQuery = `
        SELECT * FROM prescriptions 
        WHERE id = ? AND (doctor_id = ? OR patient_id IN (
          SELECT patient_id FROM doctor_patient_links WHERE doctor_id = ?
        ))
      `;
      queryParams = [prescriptionId, userId, userId];
    } else if (userRole === 'Patient') {
      checkPermissionQuery = `
        SELECT * FROM prescriptions 
        WHERE id = ? AND patient_id = (SELECT id FROM patients WHERE user_id = ?)
      `;
      queryParams = [prescriptionId, userId];
    } else {
      return res.status(403).json({ error: 'Anda tidak memiliki izin untuk melihat resep ini' });
    }
  
    db.query(checkPermissionQuery, queryParams, (checkErr, checkResults) => {
      if (checkErr) {
        console.error('Error saat memeriksa izin:', checkErr);
        return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa izin' });
      }
  
      if (checkResults.length === 0) {
        return res.status(403).json({ error: 'Anda tidak berhak melihat detail resep ini' });
      }
  
      const getPrescriptionDetailsQuery = `
        SELECT p.id, p.created_at, u.fullname as doctor_name, 
               pm.medication_name, pm.dosage, pm.frequency
        FROM prescriptions p
        JOIN users u ON p.doctor_id = u.id
        JOIN prescription_medications pm ON p.id = pm.prescription_id
        WHERE p.id = ?
      `;
  
      db.query(getPrescriptionDetailsQuery, [prescriptionId], (err, results) => {
        if (err) {
          console.error('Error saat mengambil detail resep:', err);
          return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil detail resep' });
        }
  
        if (results.length === 0) {
          return res.status(404).json({ error: 'Resep tidak ditemukan' });
        }
  
        const prescription = {
          id: results[0].id,
          created_at: results[0].created_at,
          doctor_name: results[0].doctor_name,
          medications: results.map(row => ({
            name: row.medication_name,
            dosage: row.dosage,
            frequency: row.frequency
          }))
        };
  
        res.status(200).json({ prescription });
      });
    });
  };

  const getPatientOwnPrescriptions = (req, res) => {
    const userId = req.userId;
    const userRole = req.userRole;
  
    if (userRole !== 'Patient') {
      return res.status(403).json({ error: 'Hanya pasien yang dapat mengakses resep mereka sendiri' });
    }
  
    const getPatientIdQuery = 'SELECT id FROM patients WHERE user_id = ?';
    db.query(getPatientIdQuery, [userId], (patientErr, patientResults) => {
      if (patientErr) {
        console.error('Error saat mengambil ID pasien:', patientErr);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data pasien' });
      }
  
      if (patientResults.length === 0) {
        return res.status(404).json({ error: 'Data pasien tidak ditemukan' });
      }
  
      const patientId = patientResults[0].id;
  
      const getPrescriptionsQuery = `
        SELECT p.id as prescription_id, p.created_at, u.fullname as doctor_name
        FROM prescriptions p
        JOIN users u ON p.doctor_id = u.id
        WHERE p.patient_id = ?
        ORDER BY p.created_at DESC
      `;
  
      db.query(getPrescriptionsQuery, [patientId], (err, results) => {
        if (err) {
          console.error('Error saat mengambil resep:', err);
          return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil resep' });
        }
  
        res.status(200).json({ prescriptions: results });
      });
    });
  };

module.exports = { prescribeMedication, getPatientPrescriptions, getPrescriptionDetails, getPatientOwnPrescriptions };