const express = require('express');
const router = express.Router();
const { signup, signin, signout, getUser } = require('../controller/Account');
const { authenticateToken } = require('../middleware/Authentication');

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/signout', signout);
router.get('/fullname', authenticateToken, getUser);

//buat test token
router.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Access granted to protected route', user: req.user });
});

module.exports = router;
