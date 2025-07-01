import { Router } from 'express';
import { verifyToken } from '../middlewares/VerifyToken';
import FileController, { upload } from '../controllers/FileController';

const router = Router();

const fileController = new FileController();

router.post('/folders', verifyToken, fileController.createFolder);

router.get('/folders', verifyToken, fileController.listFolders);

router.get('/list', verifyToken, fileController.listFiles.bind(fileController));

router.post('/upload', verifyToken, upload.single('file'), fileController.uploadFile.bind(fileController));

router.post('/download', verifyToken, fileController.downloadFile.bind(fileController));

router.put('/update', verifyToken, fileController.updateFileName.bind(fileController));

router.delete('/delete', verifyToken, fileController.deleteFile.bind(fileController));

export default router;