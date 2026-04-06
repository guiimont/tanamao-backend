import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { senha } = req.body;

    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_password")
      .single();

    if (error || !data || senha !== data.value) {
      return res.status(401).json({ ok: false });
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error("[login:error]", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
