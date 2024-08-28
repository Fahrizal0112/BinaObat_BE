const express = require('express');
const router = express.Router();
const { signin, signout, getUser, linkDoctorToPatient, signup } = require('../controller/Account');
const { authenticateToken } = require('../middleware/Authentication');
const { signupDoctor, createDoctorSignupToken, createPatientByDoctor, getPatients, deletePatient } = require('../controller/admincontroller');
const { prescribeMedication, getPatientPrescriptions, getPrescriptionDetails, getPatientOwnPrescriptions } = require('../controller/patient');

router.post('/signup', signupDoctor);
router.post('/signupadmin', signup);
router.post('/signup-patient', authenticateToken, createPatientByDoctor);
router.post('/create-doctor-token', authenticateToken, createDoctorSignupToken);

router.get('/get-patients', authenticateToken, getPatients);
router.delete('/delete-patient/:patientId', authenticateToken, deletePatient);

router.post('/signin', signin);
router.post('/signout', signout);
router.get('/fullname', authenticateToken, getUser);
router.post('/link-doctor-patient', authenticateToken, linkDoctorToPatient);

router.post('/prescribe', authenticateToken, prescribeMedication);
router.get('/:patientId/prescriptions', authenticateToken, getPatientPrescriptions);
router.get('/prescription/:prescriptionId', authenticateToken, getPrescriptionDetails);
router.get('/prescriptionsid', authenticateToken, getPatientOwnPrescriptions);

//buat test token
router.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Access granted to protected route', user: req.user });
});

module.exports = router;
