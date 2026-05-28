import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import matchesRouter from "./matches";
import eventsRouter from "./events";
import statsRouter from "./stats";
import storageRouter from "./storage";
import lisasRouter from "./lisas";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(matchesRouter);
router.use(eventsRouter);
router.use(statsRouter);
router.use(storageRouter);
router.use(lisasRouter);

export default router;
