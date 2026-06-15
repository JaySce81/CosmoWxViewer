import { Router, type IRouter } from "express";
import healthRouter from "./health";
import galaxiesRouter from "./galaxies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(galaxiesRouter);

export default router;
