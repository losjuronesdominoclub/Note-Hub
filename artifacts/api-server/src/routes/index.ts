import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import matchesRouter from "./matches";
import eventsRouter from "./events";
import statsRouter from "./stats";
import storageRouter from "./storage";
import lisasRouter from "./lisas";
import lisasRecibidasRouter from "./lisas-recibidas";
import resetRouter from "./reset";
import dailyResultsRouter from "./daily-results";
import streamRouter from "./stream";
import compareRouter from "./compare";
import rulesRouter from "./rules";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(matchesRouter);
router.use(eventsRouter);
router.use(statsRouter);
router.use(storageRouter);
router.use(lisasRouter);
router.use(lisasRecibidasRouter);
router.use(resetRouter);
router.use(dailyResultsRouter);
router.use(streamRouter);
router.use(compareRouter);
router.use(rulesRouter);

export default router;
