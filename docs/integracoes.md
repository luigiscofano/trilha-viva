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

## Roteiro concreto de implantação, sem ativação automática

### O que já existe no repositório

- `server/study-server.mjs`: gateway opcional; valida a resposta final, referencia os trechos originais e mantém tudo pendente de revisão. Dois adaptadores alternativos, `n8n` e `openai`; não chamar ambos em paralelo.
- `integrations/n8n/trilha-viva.template.json`: template escrito manualmente, inativo, não importado nem executado em uma conta. Leia o README ao lado antes de preencher credenciais. Não é prova de uso efetivo do n8n.
- `integrations/examples/completed-task.json`: evento **fictício** para comparar uma única etapa em Make ou Zapier. O produto não emite esse evento nem possui um webhook de saída ativo. Não contém material de estudo, e-mail, nome de aluno ou credenciais.

### Teste de bancada n8n

1. Faça backup da instância, importe o template em área de teste e mantenha inativo. Confira compatibilidade dos nós com sua versão.
2. Configure duas credenciais distintas: segredo do webhook recebido e chave do provedor. Confirme plano, orçamento e modelo antes de executar. Não insira credenciais no JSON versionado.
3. Use apenas material fictício e um único pedido manual. O backend deve receber JSON válido com referências existentes e status pendente. Modelo que não suporte o contrato deve falhar, nunca produzir conteúdo falso para esconder falha.
4. Teste segredo ausente (nega), referência inventada (backend rejeita), timeout (sem salvar), limite excedido e insuficiência de evidência. O backend atual **não retenta** automaticamente para não duplicar custos; idempotência e retries são possíveis evoluções, não funcionalidades prontas.
5. Documente data, versão dos nós, modelo configurado, métricas e evidência higienizada em um PR. Somente então declarar integração validada. Mantenha retenção de execuções desabilitada/minimizada e confira os logs da infraestrutura.

### Comparação Make ou Zapier, uma alternativa por vez

1. Crie uma planilha de teste vazia com colunas `eventId`, `taskId`, `title`, `completedAt`.
2. Após autorização da conta/plano, crie um gatilho webhook ou entrada manual compatível com o plano. A URL do webhook é segredo operacional e fica fora do repositório.
3. Forneça manualmente o arquivo fictício acima. Valide `schemaVersion=1`, `eventType=study_task_completed`, `demo=true`, IDs não vazios e data ISO; descarte os demais campos.
4. Busque `eventId` na planilha e grave só se não existir. Envie o mesmo evento duas vezes e confira que há uma única linha. Essa deduplicação demonstra a ideia em teste; consulta seguida de escrita não é transação atômica, portanto não promete proteção contra concorrência produtiva.
5. Compare quantidade de etapas/operações, tempo e facilidade de manutenção. Não invente custo atual: confira o plano escolhido antes. Não ativar os dois fluxos juntos, enviar e-mails ou ligar lembretes reais.
6. Exporte blueprint quando o plano permitir; higienize IDs de conexões, contas, URLs, tokens e dados fixados. Se não permitir, registre passos/campos e capturas fictícias, não um arquivo falsamente apresentado como exportação.

### Briefs reproduzíveis para ferramentas de interface e editor

Estes são briefs para uso futuro, **não histórico de prompts já executados**:

- **v0, branch `experiment/v0-review`:** “Crie uma alternativa isolada da tela de revisão do Trilha Viva com documento fictício à esquerda e resumo/pergunta editável à direita, referência clicável ao trecho, ações aceitar/descartar, foco visível e mobile sem rolagem horizontal. Respeite a direção azul aprovada, logo Páginas e ícones; não substitua a aplicação nem conecte serviços.”
- **Bolt, branch `experiment/bolt-planner`:** “Prototipe só um planejador de revisões com tarefas fictícias, ajuste de data, conclusão, vazio e erro. Sem IA simulada como real, contas, notificações ou sincronização. Compare com o fluxo existente sem alterar sua identidade.”
- **Cursor, branch `quality/cursor-review`:** “Revise o diff de um PR local autorizado; investigue validação de referências, backup, erros e acessibilidade. Escreva testes de regressão; não leia `.env`, não envie documentos privados, não faça deploy nem publique commits automaticamente.”

Antes de abrir o checkout em um serviço externo, revisar quais arquivos serão compartilhados e as permissões da conta. Guardar no PR: ferramenta realmente utilizada, data, prompt, arquivos incorporados, testes e limitações. Não aprovar ou mergear automaticamente uma proposta visual divergente da direção já aprovada.
