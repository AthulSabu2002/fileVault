import { Router } from 'express';
import AuthController from '../controllers/AuthController';

const router = Router();

const authController = new AuthController()

router.post('/signUp', authController.createUser.bind(authController));
router.post('/signIn', authController.signIn.bind(authController));

export default router;