import { Router, type IRouter } from "express";
import healthRouter from "./health";
import esportsRouter from "./esports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(esportsRouter);

export default router;
