const express = require('express');
const router = express.Router();
const Game = require('../../models/Game');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs').promises;
const { encryptFile } = require('../../utils/encryption');
const authMiddleware = require('../middleware/auth');

// Configure file upload middleware
router.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    abortOnLimit: true
}));

// Upload route with authentication
router.post('/', authMiddleware, async (req, res) => {
    try {
        // Check if user is authorized (specific user ID check)
        if (req.userId !== 863142225210507294) {
            return res.status(403).json({ error: 'Unauthorized to upload files' });
        }

        // Check for game ID
        if (!req.body.gameId) {
            return res.status(400).json({ error: 'Game ID is required' });
        }

        // Verify game exists
        const game = await Game.findById(req.body.gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: 'No files were uploaded' });
        }

        const file = req.files.file;
        
        // Get file extension and mime type
        const fileExt = path.extname(file.name).toLowerCase();
        const mimeType = file.mimetype;

        // Define valid file types
        const validExtensions = ['.exe', '.dll', '.sys'];
        const validMimeTypes = [
            'application/x-msdownload',
            'application/x-executable',
            'application/x-dosexec',
            'application/vnd.microsoft.portable-executable'
        ];

        if (!validExtensions.includes(fileExt)) {
            console.error(`Invalid file extension: ${fileExt}`);
            return res.status(400).json({ 
                error: 'Invalid file type',
                details: {
                    detected: {
                        extension: fileExt,
                        mimeType: mimeType
                    },
                    allowed: {
                        extensions: validExtensions,
                        mimeTypes: validMimeTypes
                    }
                }
            });
        }

        // Verify file header for PE format (MZ header)
        const fileHeader = file.data.slice(0, 2).toString('hex');
        if (fileHeader !== '4d5a') { // MZ header in hex
            console.error(`Invalid PE format - Missing MZ header: ${fileHeader}`);
            return res.status(400).json({ 
                error: 'Invalid file format. File must be a valid Windows PE file (EXE/DLL/SYS)'
            });
        }

        // Additional PE validation - check for PE header
        const peOffset = file.data.readUInt32LE(0x3c);
        const peHeader = file.data.slice(peOffset, peOffset + 4).toString('hex');
        if (peHeader !== '50450000') { // PE\0\0 signature
            console.error(`Invalid PE signature: ${peHeader}`);
            return res.status(400).json({
                error: 'Invalid PE signature. File must be a valid Windows PE file'
            });
        }

        // Encrypt file content
        const encryptedContent = encryptFile(file.data);

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../../uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        // Create game-specific directory
        const gameDir = path.join(uploadsDir, game._id.toString());
        await fs.mkdir(gameDir, { recursive: true });

        // Save encrypted file
        const fileName = `${Date.now()}-${file.name}.encrypted`;
        const filePath = path.join(gameDir, fileName);
        await fs.writeFile(filePath, encryptedContent);

        res.json({
            message: 'File uploaded and encrypted successfully',
            fileName: fileName,
            gameId: game._id,
            gameName: game.name
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

// Get files for a specific game
router.get('/game/:gameId', authMiddleware, async (req, res) => {
    try {
        // Check if user is authorized
        if (req.userId !== 863142225210507294) {
            return res.status(403).json({ error: 'Unauthorized to access files' });
        }

        const { gameId } = req.params;

        // Verify game exists
        const game = await Game.findById(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Get files from game directory
        const gameDir = path.join(__dirname, '../../uploads', gameId);
        
        try {
            const files = await fs.readdir(gameDir);
            const fileDetails = await Promise.all(files.map(async (fileName) => {
                const filePath = path.join(gameDir, fileName);
                const stats = await fs.stat(filePath);
                return {
                    fileName,
                    size: stats.size,
                    uploadDate: stats.mtime
                };
            }));

            res.json({
                gameId,
                gameName: game.name,
                files: fileDetails
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Directory doesn't exist - no files yet
                res.json({
                    gameId,
                    gameName: game.name,
                    files: []
                });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error fetching game files:', error);
        res.status(500).json({ error: 'Failed to fetch game files' });
    }
});

module.exports = router;
