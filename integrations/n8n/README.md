# Modelo n8n (não executado)

Este JSON foi escrito para preparação de uma integração. **Não foi exportado de uma instância em funcionamento, importado ou testado no n8n nesta entrega.** O workflow está inativo, não contém credenciais e usa um nome de modelo deliberadamente inválido. Não há chamadas à IA ao apenas ler este arquivo.

## Configurar somente após autorização de acesso e custos

1. Importar `trilha-viva.template.json` em instância n8n própria/autorizada. Conferir compatibilidade dos nós na versão instalada; ajustar sem ativar.
2. Criar credencial Header Auth do webhook com nome `x-trilha-secret` e um segredo aleatório com pelo menos 32 caracteres. É o mesmo valor de `N8N_SHARED_SECRET` no backend. **Não usar a credencial da API de IA no webhook.**
3. Selecionar essa credencial em “Receber material autorizado”. Manter o webhook autenticado; nunca ativar o template como endpoint aberto.
4. Criar outra credencial Header Auth para o provedor, header `Authorization` e valor `Bearer SUA_CHAVE`. Guardar somente no cofre de credenciais do n8n. Não salvar o valor no JSON, no GitHub ou nas imagens.
5. No nó HTTP, selecionar a credencial do provedor e substituir `CONFIGURAR_MODELO_APOS_APROVACAO_DE_CUSTOS` por modelo disponível na conta. Conferir cobrança e limites vigentes antes do teste. O limite de tokens de saída é 3000; o provedor/modelo precisa suportar JSON mode.
6. Testar somente material fictício. Confirmar no backend que referência inválida é recusada e que todas as sugestões chegam como pendentes. O backend faz a validação final das páginas e IDs, mesmo que o workflow retorne estrutura válida.
7. Habilitar HTTPS, limitar acesso e chamadas por orçamento. Manter retenção de execução minimizada; conferir configurações de logs/erros da instância e do provedor. O template solicita não salvar dados de execução, mas a infraestrutura pode registrar metadados.
8. Só então ativar manualmente e configurar `AI_PROVIDER=n8n`, `N8N_WEBHOOK_URL` e `N8N_SHARED_SECRET` no backend. Nunca mandar o segredo do n8n ao navegador.

## Limitações

- Segurança contra prompt injection é redução de risco, não garantia. O documento é tratado como dados, sem ferramentas de ação externas conectadas.
- O fluxo não envia mensagens, notificações ou e-mails.
- O JSON não inclui IDs de credencial, dados fixados ou segredos. Ao exportar uma versão real, revisar tudo de novo.
- O template usa OpenAI como exemplo de provedor; a disponibilidade/cobrança não foi verificada para uma conta do usuário. Nenhum plano foi contratado.
