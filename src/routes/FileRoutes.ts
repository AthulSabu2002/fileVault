import { Router } from 'express';
import { verifyToken } from '../middlewares/VerifyToken';
import FileController, { upload } from '../controllers/FileController';

const router = Router();

const fileController = new FileController();

router.post('/upload', verifyToken, upload.single('file'), fileController.uploadFile.bind(fileController));
router.post('/download', verifyToken, fileController.downloadFile.bind(fileController));

export default router;