import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middlewares/VerifyToken';
import FileController from '../controllers/FileController';

const router = Router();
const upload = multer({ dest: 'uploads/' });

const fileController = new FileController();

router.post('/upload', verifyToken, upload.single('file'), fileController.uploadFile.bind(fileController));
router.post('/download', verifyToken, fileController.downloadFile.bind(fileController));

export default router;
