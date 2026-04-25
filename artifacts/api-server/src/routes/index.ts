import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import burnHistoryRouter from "./burnHistory";
import savedTokensRouter from "./savedTokens";
import explorerRouter from "./explorer";
import uniswapRouter from "./uniswap";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(burnHistoryRouter);
router.use(savedTokensRouter);
router.use(explorerRouter);
router.use(uniswapRouter);

export default router;
