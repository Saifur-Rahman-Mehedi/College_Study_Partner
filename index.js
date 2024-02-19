const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

app.use(express.static(__dirname));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '$@!*BAN#',
  database: 'study_partner'
});

db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database successfully.');
});

app.post('/submit-profile', upload.single('profilePicture'), (req, res) => {
  const { name, major, year, bio, preferredLocation } = req.body;
  const courses = req.body['courses[]'];
  const profilePictureUrl = req.file ? req.file.path : '';

  db.beginTransaction(err => {
    if (err) {
      console.error('Transaction Error:', err);
      return res.status(500).send('Server error starting transaction.');
    }

    const userInsertSql = `INSERT INTO users (name, profile_picture_url, major, year, bio, preferred_location) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(userInsertSql, [name, profilePictureUrl, major, year, bio, preferredLocation], (error, userInsertResult) => {
      if (error) {
        return db.rollback(() => {
          console.error('User Insertion Error:', error);
          res.status(500).send('Server error. Transaction rolled back.');
        });
      }

      const userId = userInsertResult.insertId;

      const courseInsertPromises = courses.map(courseName => {
        return new Promise((resolve, reject) => {
          const courseInsertSql = 'INSERT INTO user_courses (user_id, course_name) VALUES (?, ?)';
          db.query(courseInsertSql, [userId, courseName], error => {
            if (error) reject(error);
            else resolve();
          });
        });
      });

      Promise.all(courseInsertPromises)
        .then(() => {
          db.commit(err => {
            if (err) {
              return db.rollback(() => {
                console.error('Commit Error:', err);
                res.status(500).send('Server error. Transaction rolled back.');
              });
            }
            res.send('Profile submitted successfully.');
          });
        })
        .catch(error => {
          console.error('Course Insertion Error:', error);
          db.rollback(() => {
            res.status(500).send('Server error. Transaction rolled back.');
          });
        });
    });
  });
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});