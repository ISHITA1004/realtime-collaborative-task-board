import { Router } from 'express';
import * as boardController from '../controllers/board.controller';
import * as taskController from '../controllers/task.controller';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);

router.post('/', asyncHandler(boardController.createBoard));
router.get('/', asyncHandler(boardController.listBoards));
router.get('/:id', asyncHandler(boardController.getBoard));
router.patch('/:id', asyncHandler(boardController.renameBoard));
router.delete('/:id', asyncHandler(boardController.deleteBoard));

router.post('/:id/members', asyncHandler(boardController.addMember));
router.delete('/:id/members/:userId', asyncHandler(boardController.removeMember));

router.get('/:id/activity', asyncHandler(boardController.listActivity));

router.post('/:id/tasks', asyncHandler(taskController.createTask));
router.get('/:id/tasks', asyncHandler(taskController.listTasks));

export default router;
