const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check if it's an API token
        if (token === process.env.API_TOKEN) {
            req.userId = process.env.OWNER_ID; 
            next();
            return;
        }

        // If not API token, verify as JWT
        console.log('Verifying JWT token:', token);
        console.log('Token length:', token.length);
        console.log('Token parts:', token.split('.').length);
        console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = authMiddleware;
