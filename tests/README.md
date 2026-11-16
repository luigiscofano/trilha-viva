# Testes

Execute `npm test` na raiz. As suítes usam `node:test` e `node:assert`, com arquivos sintéticos e respostas controladas, sem documentos privados.

- `core.test.mjs`: referências, revisão, tarefas, importação/exportação, conflitos, migração v1 → v2, histórico e integridade de exclusões.
- `pdf.test.mjs`: PDF.js real lendo PDFs sintéticos com tabela xref válida; apenas timeout utiliza motor controlado.
- `ocr.test.mjs`: limites, segurança, reconhecimento e cancelamento conforme cenários definidos; a integração real no navegador requer QA adicional.
- `reminders.test.mjs`: calendário ICS e comportamento de alarmes opt-in.
- `ai-contract.test.mjs`, `ai-client.test.mjs`: contrato e integração com respostas controladas.
- `server.test.mjs`, `server-link.test.mjs`: API, autorização, limites e importação de links.

Um teste com mock não comprova conexão com n8n ou provedor de IA. Testes Node não substituem teclado, leitores de tela, Safari/iOS físico ou inspeção visual responsiva. Registre execuções e lacunas em [validação](../docs/validacao.md); não declare produção apenas porque testes locais passaram.
