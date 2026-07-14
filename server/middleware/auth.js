const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rsgym_jwt_secret_2026';
const JWT_EXPIRES = '24h';

function generateToken(user) {
  return jwt.sign(
    { id: user.memberId || user.id, name: user.name, role: user.role || 'admin' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (err) {}
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { generateToken, authenticateToken, optionalAuth, requireAdmin, JWT_SECRET };
