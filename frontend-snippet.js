// Substitua no seu index.html
// 1) Troque o botão final para chamar finalizarPedido()
// 2) Adicione este script dentro do seu <script>

const BACKEND_URL = "https://SEU-BACKEND-AQUI.onrender.com";

async function finalizarPedido() {
  try {
    const ativos = PRODS.filter(p => qtds[p.id] > 0);
    if (!ativos.length) {
      alert("Selecione pelo menos um item.");
      return;
    }

    if (!pagSel) {
      alert("Escolha a forma de pagamento.");
      return;
    }

    let cliente = clienteAtual;

    if (!cliente) {
      const nome = document.getElementById("m-nome")?.value?.trim() || "";
      const tel = document.getElementById("m-tel")?.value?.trim() || "";
      const idade = document.getElementById("m-idade")?.value?.trim() || "";
      const profissao = document.getElementById("m-prof")?.value?.trim() || "";
      const casado = document.getElementById("m-casado")?.checked || false;
      const filhos = document.getElementById("m-filhos")?.checked || false;

      if (!nome || !tel) {
        alert("Preencha nome e WhatsApp.");
        return;
      }

      cliente = { nome, telefone: tel, idade, profissao, casado, filhos };
      localStorage.setItem("tanamao_cliente", JSON.stringify({
        nome,
        tel,
        idade,
        prof: profissao,
        casado,
        filhos
      }));
    } else {
      cliente = {
        nome: cliente.nome,
        telefone: cliente.tel,
        idade: cliente.idade,
        profissao: cliente.prof,
        casado: cliente.casado,
        filhos: cliente.filhos
      };
    }

    const payload = {
      items: ativos.map(p => ({ id: p.id, quantity: qtds[p.id] })),
      paymentMethod: pagSel,
      customer: cliente,
      source: "site"
    };

    const response = await fetch(`${BACKEND_URL}/api/checkout/create-preference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error(data);
      alert(data.message || "Erro ao iniciar pagamento.");
      return;
    }

    window.location.href = data.checkoutUrl;
  } catch (error) {
    console.error(error);
    alert("Erro ao conectar com o pagamento. Tente novamente.");
  }
}
