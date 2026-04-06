import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { senha } = req.body;

    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_password")
      .single();

    if (!data || senha !== data.value) {
      return res.status(401).json({ ok: false });
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
