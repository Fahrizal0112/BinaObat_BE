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

module.exports = { prescribeMedication };