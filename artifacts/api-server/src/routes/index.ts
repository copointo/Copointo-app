import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import cafeDashRouter from "./cafe-dashboard";
import { cafes } from "../store";
import { geocodeAddress } from "../utils/geocode";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/cafe/:cafeId", cafeDashRouter);

// Public cafes endpoint for mobile app
router.get("/cafes", async (_req, res) => {
  const active = cafes.filter(c => c.active);

  // Lazy backfill: geocode any active cafe missing coordinates (in parallel, capped)
  const missing = active.filter(c => (c.lat == null || c.lng == null) && c.address);
  if (missing.length) {
    await Promise.all(missing.slice(0, 10).map(async c => {
      const geo = await geocodeAddress(c.address);
      if (geo) { c.lat = geo.lat; c.lng = geo.lng; }
    }));
  }

  const publicCafes = active.map(c => ({
    id: c.id, name: c.name, logo: c.logo, image: c.image,
    openTime: c.openTime, closeTime: c.closeTime,
    rating: c.rating, tags: c.tags, address: c.address,
    lat: c.lat, lng: c.lng,
  }));
  res.json({ cafes: publicCafes });
});

// Public single-cafe endpoint
router.get("/cafes/:id", (req, res) => {
  const c = cafes.find(x => x.id === req.params.id);
  if (!c) { res.status(404).json({ error: "Cafe not found" }); return; }
  res.json({
    cafe: {
      id: c.id, name: c.name, logo: c.logo, image: c.image,
      openTime: c.openTime, closeTime: c.closeTime,
      rating: c.rating, tags: c.tags, address: c.address,
      active: c.active,
      lat: c.lat, lng: c.lng,
    }
  });
});

export default router;
