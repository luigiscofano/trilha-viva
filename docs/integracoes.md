# Integrações: execução real, não logotipos

## Inventário desta etapa

Não houve acesso autenticado a n8n, Make, Zapier, v0, Bolt ou Cursor nesta execução. Nenhuma dessas ferramentas foi usada para construir a prévia. Não foram criadas contas nem contratados planos. Não há gastos com IA. As etapas abaixo são propostas reproduzíveis, não evidência de execução.

## n8n como fluxo principal

1. Escolher instância do usuário (cloud ou self-hosted) e conferir custos/limites oficiais do plano antes de habilitar qualquer serviço pago.
2. Criar workflow inativo: Webhook autenticado → validação do contrato → chamada ao provedor autorizado → validação de JSON → resposta ao backend.
3. O navegador envia ao backend apenas o material selecionado, após informar o destinatário e obter autorização. Backend guarda segredos; não expor webhook/chave diretamente num site público.
4. Usar o contrato `createStudyRequest()` e validar a resposta com `validateStudyResponse()`. Nunca aceitar IDs de referência não recebidos no pedido, nem páginas inventadas. Toda sugestão entra como `pending`.
5. Limitar requisição a 300 mil caracteres, 30 sugestões e timeout. Aplicar limites por usuário e orçamento, não confiar somente no frontend. Retentar apenas falhas transitórias, com idempotência.
6. No prompt, separar instruções do sistema dos trechos não confiáveis. Documentos podem conter instruções maliciosas; nunca executar ações descritas neles.
7. Usar somente dados fictícios no primeiro teste. Registrar resultados e falhas sem texto privado. Exportar workflow, retirar credenciais, nomes pessoais, IDs sensíveis, pinData e headers antes de publicar.

## Etapa pequena comparável em Make e Zapier

Escolher **uma tarefa concluída → criar linha em planilha de teste** como fluxo demonstrativo opcional. Não ativar as três alternativas simultaneamente no produto.

- Make: webhook de teste → validar ID/data/título → adicionar linha em planilha fictícia. Exportar blueprint quando permitido e recriar conexões na conta de quem importa.
- Zapier: trigger compatível com plano → filtro/transformação quando disponível → criar linha na mesma estrutura de planilha fictícia. Webhooks e fluxos multietapas podem exigir plano pago. Se exportação não disponível, documentar cada campo e capturas higienizadas.
- Não enviar e-mails/notificações. Não usar dados reais de alunos para comparação pública.

## v0, Bolt e Cursor

- v0: solicitar proposta inicial para tela de revisão com fonte ao lado; exportar código para branch experimental, registrar prompt, data e resultado. Só incorporar após aprovação e revisão.
- Bolt: prototipar alternativa da tela de planejamento com os mesmos dados fictícios; comparar responsividade, acessibilidade e código. Não ligar ambos ao fluxo produtivo sem motivo.
- Cursor: abrir checkout autorizado no aplicativo do usuário, solicitar revisão/testes de um PR e registrar contribuições reais. Usar outro editor ou agente não equivale a usar Cursor.

## Contrato de resposta esperado

```json
{
  "schemaVersion": 1,
  "suggestions": [{
    "id": "sugestao-1",
    "materialId": "material-exemplo",
    "type": "question",
    "title": "Fluxo de energia",
    "content": "Como a energia percorre a cadeia alimentar?",
    "answer": "Dos produtores aos consumidores, com dissipação de calor.",
    "references": [{ "chunkId": "material-exemplo-trecho-1", "page": null }]
  }]
}
```

Se não houver evidência suficiente: `{"schemaVersion":1,"insufficientEvidence":true}`.

## Avaliação antes de habilitar

Montar conjunto fictício com: texto curto, múltiplas páginas, conteúdo contraditório, página vazia, instruções maliciosas, texto sem resposta. Conferir manualmente: resposta sustentada pela fonte, referência real, pergunta não ambígua, ausência de instruções externas obedecidas. Medir taxa de referências válidas e taxa de respostas corretas separadamente. Não prometer precisão universal.

## Fontes oficiais e custos

- PDF.js: https://mozilla.github.io/pdf.js/examples/
- n8n: https://docs.n8n.io/build/manage-workflows/export-and-import/
- Make: https://help.make.com/blueprints
- Zapier: https://help.zapier.com/
- v0: https://v0.app/docs/github
- Bolt: https://support.bolt.new/integrations/git
- Cursor: https://cursor.com/docs

Custos de hospedagem, n8n, automatizações e tokens de IA continuam não aprovados. Não apresentamos valores como atuais sem consultar o plano e preços no momento da configuração.
