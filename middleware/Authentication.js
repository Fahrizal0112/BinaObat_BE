const jwt = require('jsonwebtoken');
const { db } = require('../DBHandler');

const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const query = 'SELECT id FROM users WHERE id = ?';
    db.query(query, [decoded.userId], (err, results) => {
      if (err || results.length === 0) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      req.userId = results[0].id;
      next();
    });
  } catch (error) {
    res.status(403).json({ message: 'Token is not valid' });
  }
};

module.exports = { authenticateToken };
