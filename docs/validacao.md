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
