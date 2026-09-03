import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { uploadController } from '../controllers/uploadController';
import { optionalAuth } from '../middleware/auth';
import { uploadRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthRequest } from '../types';
import { BadRequestError } from '../utils/errors';
import { config } from '../config';

const router = Router();

const ALLOWED_EXTENSIONS = new Set(['.rs', '.wasm']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadSizeBytes },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new BadRequestError(`Unsupported file type: ${ext || 'unknown'}. Expected .rs or .wasm`));
      return;
    }
    cb(null, true);
  },
});

// POST /api/upload - Analyze contract. Works signed-out (the report just
// isn't saved to a project/history); signed-in requests get the result
// persisted, matching uploadController's userId-optional branch below.
router.post(
  '/',
  uploadRateLimit,
  optionalAuth,
  upload.single('contract'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    const report = await uploadController.analyzeContract(req.file, req.user?.id);
    res.json(report);
  })
);

export default router;
