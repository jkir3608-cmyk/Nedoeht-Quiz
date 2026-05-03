import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import quizzesRouter from "./quizzes";
import questionsRouter from "./questions";
import aiRouter from "./ai";
import gamesRouter from "./games";
import playersRouter from "./players";
import dashboardRouter from "./dashboard";
import adminMediaRouter from "./adminMedia";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(quizzesRouter);
router.use(questionsRouter);
router.use(aiRouter);
router.use(gamesRouter);
router.use(playersRouter);
router.use(dashboardRouter);
router.use(adminMediaRouter);

export default router;
