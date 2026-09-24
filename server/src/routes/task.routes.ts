import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);

router.patch('/:id', asyncHandler(taskController.updateTask));
router.delete('/:id', asyncHandler(taskController.deleteTask));

export default router;
