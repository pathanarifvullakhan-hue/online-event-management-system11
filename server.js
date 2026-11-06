const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'event_management_secret_key',
    resave: false,
    saveUninitialized: true
}));

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'student'
    )`);

    db.run(`CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT,
        location TEXT,
        capacity INTEGER
    )`);

    db.run(`CREATE TABLE registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        event_id INTEGER,
        registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(event_id) REFERENCES events(id),
        UNIQUE(user_id, event_id)
    )`);

    const hash = bcrypt.hashSync('admin123', 10);
    const studentHash = bcrypt.hashSync('student123', 10);
    
    db.run(`INSERT INTO users (name, email, password, role) VALUES ('System Admin', 'admin@event.com', '${hash}', 'admin')`);
    db.run(`INSERT INTO users (name, email, password, role) VALUES ('John Doe', 'student@event.com', '${studentHash}', 'student')`);

    db.run(`INSERT INTO events (title, description, date, location, capacity) VALUES 
        ('Tech Hackathon 2026', '24-hour coding challenge for developers.', '2026-12-01', 'Auditorium A', 100),
        ('DevOps Workshop', 'Hands-on session with Docker, Jenkins & K8s.', '2026-11-20', 'Lab 3', 50),
        ('AI & ML Symposium', 'Guest lectures on latest AI trends.', '2026-11-25', 'Main Hall', 200)
    `);
});

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'All fields are required' });
    }
    const hash = bcrypt.hashSync(password, 10);
    db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [name, email, hash], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ status: 'error', message: 'Duplicate registration prevented: Email already registered' });
            }
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', message: 'Registration successful' });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ status: 'error', message: 'Invalid credentials' });
        }
        if (bcrypt.compareSync(password, user.password)) {
            req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
            res.json({ status: 'success', message: 'Login successful', user: req.session.user });
        } else {
            res.status(400).json({ status: 'error', message: 'Invalid credentials' });
        }
    });
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ status: 'success', message: 'Logged out' });
});

app.get('/api/current_user', (req, res) => {
    res.json({ user: req.session.user || null });
});

app.get('/api/events', (req, res) => {
    db.all(`SELECT * FROM events`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/events/register', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ status: 'error', message: 'Please login to register for events' });
    }
    const { event_id } = req.body;
    const user_id = req.session.user.id;

    db.run(`INSERT INTO registrations (user_id, event_id) VALUES (?, ?)`, [user_id, event_id], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ status: 'error', message: 'Already registered for this event' });
            }
            return res.status(500).json({ status: 'error', message: err.message });
        }
        res.json({ status: 'success', message: 'Event registration confirmation: Registered successfully!' });
    });
});

app.get('/api/my-registrations', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const query = `
        SELECT events.*, registrations.registration_date 
        FROM registrations 
        JOIN events ON registrations.event_id = events.id 
        WHERE registrations.user_id = ?`;
    db.all(query, [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/admin/participants', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    const query = `
        SELECT users.name as student_name, users.email, events.title as event_title, registrations.registration_date 
        FROM registrations 
        JOIN users ON registrations.user_id = users.id 
        JOIN events ON registrations.event_id = events.id`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
