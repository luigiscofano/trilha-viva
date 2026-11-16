# Validação

## Executado em 16/11/2026

- 41 testes Node: 12 núcleo, 9 extração PDF, 4 contrato IA, 4 cliente e 12 backend.
- `npm run check` e `npm run build`.
- Navegador Chromium: cadastro de texto, edição de referência, aceitação de conteúdo, filtro de aceitos e estados de IA não configurada.
- Importação real de PDF sintético de duas páginas, com referências de origem.
- Plano de tarefas e persistência após recarregar.
- Inspeção da direção azul aprovada em computador e viewport de 390 px (iframe). Não substitui um aparelho físico.

## Limites dos testes

Chamadas de IA e n8n foram simuladas nos testes; nenhum provedor real foi acionado. Make, Zapier, v0, Bolt e Cursor não foram utilizados. Sem auditoria WCAG completa, leitor de tela ou Safari/iOS físico. PDFs complexos podem exigir outros tratamentos; não há OCR. Ver README e guia de PDF.

## Acessibilidade preparada

Landmarks, rótulos, foco visível, skip link, botões nativos, aria-live, modais nativos e reduced-motion. Não declaramos conformidade integral WCAG.

## Publicação

O workflow roda testes, sintaxe e build antes de publicar `dist` em GitHub Pages. Apenas os arquivos estáticos são publicados; o backend opcional não roda no Pages. O histórico de execuções no GitHub é a evidência de implantação, não este documento.

## Evolução integrada no PR #4

A execução anterior de 41 testes e a indicação de ausência de OCR acima descrevem a entrega inicial. A branch atual acrescenta histórico schema v2, gestão de materiais com integridade de referências, OCR local opcional, calendário ICS e evolução da importação de links. A contagem anterior não deve ser reutilizada como resultado da versão nova.

O núcleo atualizado foi testado isoladamente com 18 testes passando, incluindo migração de backup v1, histórico, renomeação e exclusão explícita. O CI do PR #4 passou com 70 testes. O OCR real com Tesseract.js foi validado no navegador: duas páginas sintéticas foram reconhecidas e salvas. Esse cenário não comprova fidelidade em documentos complexos nem desempenho em todos os aparelhos.

PRs #1, #2, #3 e #4 foram integrados. A implantação do PR #4 está em andamento; não declarar que a versão nova está em produção antes de verificar o deployment. O PR #5 organizará a documentação complementar.

## Evolução local validada

70 testes passaram em 16/11/2026, incluindo migração v1→v2, histórico, exclusão com vínculos, ICS opt-in, SSRF/importação restrita e OCR. Há teste real de rasterização PDF.js/Tesseract com material sintético; o navegador Chromium também reconheceu duas páginas, mostrou o texto para revisão e salvou somente após confirmação.

QA manual adicional: renomeação preservando referências e tarefas, histórico após reload, seletor de trechos e calendário opcional. Uma colisão de nome `history` com a API do navegador foi detectada e corrigida antes do PR #4. Animações hover são limitadas a ponteiro preciso, possuem feedback de foco e desativam movimento com reduced-motion. A aplicação não depende de hover no toque.

A segurança de links foi exercitada com mocks/endereços sintéticos. Nenhum domínio externo real foi importado e nenhum serviço de IA foi ativado. A implantação pública não inclui o backend opcional.

## Tipografia A e apresentação do repositório

72 testes locais passam. Build e sintaxe passam. Chromium: Manrope nos títulos, DM Sans em corpo e botões; biblioteca navegável a 390px e desktop sem overflow horizontal. Não é auditoria de todos os navegadores. O GitHub priorizava .github/README.md. Guia preservado em .github/AUTOMACAO.md para mostrar README raiz. A lista nativa de arquivos continua acima dele.
