import { Router } from "express";
import { getShippingRates } from "../controllers/shipping.controller.js";

const router = Router();

router.get("/rates", getShippingRates);

export default router;
