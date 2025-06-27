import express, { Application } from 'express';
import fileRoutes from '../routes/FileRoutes';
import authRoutes from '../routes/AuthRoutes';
import ErrorMiddleware from '../middlewares/ErrorMiddleware';

export default class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.setMiddlewares();
    this.setRoutes();
    this.setErrorHandling();
  }

  private setMiddlewares() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setRoutes() {
    this.app.use('/api/user', authRoutes);
    this.app.use('/api/files', fileRoutes);
  }

  private setErrorHandling() {
    this.app.use(ErrorMiddleware.handleErrors);
  }

  public listen(port: number | string) {
    this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}
