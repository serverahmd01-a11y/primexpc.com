import { Router } from "express";
import { getSellProducts, getSellCascadingData } from "../controllers/sell.controller.js";

const router = Router();

router.get("/sell-products", getSellProducts);
router.get("/sell-data", getSellCascadingData);

export default router;
