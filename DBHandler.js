const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

function connectDB() {
  return new Promise((resolve, reject) => {
    db.connect((err) => {
      if (err) {
        console.error('Error connecting to MySQL:', err);
        reject(err);
      } else {
        console.log('Connected to MySQL database');
        resolve();
      }
    });
  });
}

const createTables = () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fullname VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phonenumber VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('Doctor', 'Patient', 'Admin') NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS patients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      token VARCHAR(255) UNIQUE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS doctor_patient_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT,
      patient_id INT,
      FOREIGN KEY (doctor_id) REFERENCES users(id),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      UNIQUE KEY unique_link (doctor_id, patient_id)
    )`,
    `CREATE TABLE IF NOT EXISTS doctor_signup_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token VARCHAR(255) UNIQUE NOT NULL,
      is_used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prescriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT,
      patient_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES users(id),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    )`,
    `CREATE TABLE IF NOT EXISTS prescription_medications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      prescription_id INT,
      medication_name VARCHAR(255) NOT NULL,
      dosage VARCHAR(100) NOT NULL,
      frequency VARCHAR(100) NOT NULL,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )`
  ];

  return Promise.all(tables.map(table => {
    return new Promise((resolve, reject) => {
      db.query(table, (err) => {
        if (err) {
          console.error('Kesalahan saat membuat tabel:', err);
          reject(err);
        } else {
          console.log('Tabel berhasil dibuat atau sudah ada');
          resolve();
        }
      });
    });
  }));
};

const initDatabase = async () => {
  try {
    await connectDB();
    console.log('Database terhubung');
    await createTables();
    console.log('Semua tabel berhasil dibuat atau sudah ada');
  } catch (err) {
    console.error('Kesalahan saat menginisialisasi database:', err);
  }
};

initDatabase();

module.exports = { db, connectDB };