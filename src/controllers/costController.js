// Exemplo no createCost (Aplique o mesmo no createSupplier)
export async function createCost(req, res) {
  try {
    const { description, value, category } = req.body;

    const { data, error } = await supabase
      .from("costs")
      .insert([{ description, value, category }])
      .select() // <--- ADICIONE ISSO: Garante que o dado foi persistido
      .single(); // <--- ADICIONE ISSO: Retorna o item criado

    if (error) {
      console.error("Erro ao inserir:", error);
      return res.status(500).json({ ok: false, message: error.message });
    }

    // Retornamos o dado criado para o frontend confirmar
    return res.json({ ok: true, data }); 
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Erro interno" });
  }
}
