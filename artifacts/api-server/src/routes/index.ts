import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import { cafes } from "../store";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);

// Public cafes endpoint for mobile app
router.get("/cafes", (_req, res) => {
  const publicCafes = cafes.filter(c => c.active).map(c => ({
    id: c.id, name: c.name, logo: c.logo, image: c.image,
    openTime: c.openTime, closeTime: c.closeTime,
    rating: c.rating, tags: c.tags, address: c.address,
  }));
  res.json({ cafes: publicCafes });
});

export default router;
