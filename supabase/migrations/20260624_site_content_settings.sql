insert into settings (key, value)
values (
  'site_content',
  '{
    "brandSubtitle": "Alimentação inteligente sob encomenda",
    "headerBadge": "Produção sob encomenda",
    "heroEyebrow": "Alimentação inteligente para rotina corrida",
    "heroTitle": "Comida pronta, saudável e feita no tempo certo",
    "heroDescription": "Escolha os produtos do cardápio fixo, agende a melhor data e finalize em poucos passos. A produção sob encomenda ajuda a entregar mais frescor, validade e previsibilidade.",
    "howItWorksTitle": "Como funciona",
    "step1Title": "1. Escolha seus itens",
    "step1Text": "Monte seu pedido com produtos pensados para a rotina da semana.",
    "step2Title": "2. Agende sua encomenda",
    "step2Text": "Informe a data e a janela de retirada ou entrega no fechamento do pedido.",
    "step3Title": "3. Receba com previsibilidade",
    "step3Text": "Produtos preparados sob demanda para facilitar alimentação e treino.",
    "policyTitle": "Política comercial",
    "policyHeading": "Quanto mais você organiza a semana, maior é o desconto",
    "policyIntro": "O benefício é aplicado no total do carrinho. Você ganha desconto por volume de itens e um bônus quando monta uma seleção mais variada para a rotina.",
    "policyButton": "Ver detalhes",
    "policyVolumeTitle": "Desconto por volume",
    "policyVolumeText": "3 itens: 3% · 5 itens: 6% · 8 itens: 9% · 12 itens: 12%.",
    "policyDiversityTitle": "Bônus por variedade",
    "policyDiversityText": "3 produtos diferentes: +1%. 5 produtos diferentes: +2%.",
    "policyLimitTitle": "Limite saudável",
    "policyLimitText": "O desconto máximo é de 15%, preservando qualidade, frescor e produção sob encomenda.",
    "policyPaymentNote": "O pagamento é finalizado com segurança pelo Mercado Pago, onde você escolhe Pix, cartão ou outros meios disponíveis no checkout.",
    "orderTitle": "Seu Pedido",
    "ctaTitle": "Resolva sua semana agora",
    "ctaText": "Revise seu pedido e finalize com rapidez.",
    "ctaButton": "Finalizar Pedido",
    "footerTitle": "Tá na Mão",
    "footerLine1": "Alimentação saudável pronta para quem tem rotina corrida.",
    "footerLine2": "Cardápio fixo, produção sob encomenda e organização semanal.",
    "footerTag1": "Frescor",
    "footerTag2": "Praticidade",
    "footerTag3": "Rotina saudável"
  }'::jsonb
)
on conflict (key)
do update set value = excluded.value || coalesce(settings.value, '{}'::jsonb);
