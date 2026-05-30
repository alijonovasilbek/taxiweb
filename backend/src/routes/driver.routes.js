const router = require('express').Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const controller = require('../controllers/driver.controller');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

router.post('/register', auth, controller.register);
router.get('/me', auth, controller.getMe);
router.put('/me', auth, controller.updateMe);
router.put('/me/status', auth, controller.updateStatus);
router.get('/me/earnings', auth, controller.getEarnings);
router.get('/me/rides', auth, controller.getRides);
router.post('/me/documents', auth, upload.fields([
  { name: 'license', maxCount: 1 },
  { name: 'carDoc', maxCount: 1 },
]), controller.uploadDocuments);
router.get('/nearby', auth, controller.getNearby);

module.exports = router;
