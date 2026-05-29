import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import matchesRouter from "./matches";
import eventsRouter from "./events";
import statsRouter from "./stats";
import storageRouter from "./storage";
import lisasRouter from "./lisas";
import resetRouter from "./reset";
import dailyResultsRouter from "./daily-results";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(matchesRouter);
router.use(eventsRouter);
router.use(statsRouter);
router.use(storageRouter);
router.use(lisasRouter);
router.use(resetRouter);
router.use(dailyResultsRouter);

export default router;
