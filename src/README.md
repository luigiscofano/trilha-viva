# Código da aplicação

JavaScript modular, sem framework de UI. Responsabilidades:

- `core.mjs`: materiais/trechos/referências, revisão humana, tarefas, histórico schema v2 e backup. Migra v1 sem inventar histórico. Renomear preserva vínculos; excluir dependências exige intenção explícita.
- `app.mjs`: telas e coordenação de eventos/persistência. Não incluir segredos no cliente.
- `style.css`, `brand.mjs`, `ui-helpers.mjs`: tokens visuais, marca aprovada, ícones e apresentação segura.
- `demo.mjs`: dados fictícios demonstrativos.
- `pdf.mjs`: extração de camada textual local com páginas reais.
- `ocr.mjs`: reconhecimento local opcional com Tesseract.js, workers, limites e cancelamento; validado com duas páginas sintéticas no navegador.
- `ai-client.mjs`, `ai-contract.mjs`: comunicação opcional e contrato de sugestões. Validar referências não comprova correção semântica.
- `reminders.mjs`: exportação ICS somente por ação do usuário, com alarme opt-in.

Comentários devem explicar decisões não óbvias, em português, sem repetir cada linha. Execute `npm test` e `npm run check` após alterar contratos. Não registre eventos antigos que não possam ser comprovados nem altere dados persistidos silenciosamente.
