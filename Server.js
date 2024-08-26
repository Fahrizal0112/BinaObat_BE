require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const authRoutes = require('./route/AuthRoutes');
const { connectDB } = require('./DBHandler');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

connectDB();

app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
