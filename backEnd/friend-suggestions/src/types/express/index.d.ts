import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      currentUser?: {
        id: string;
        email: string;
      };
    }
  }
}

