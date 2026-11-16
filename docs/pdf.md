# Extração de PDFs

## O que funciona

`src/pdf.mjs` usa PDF.js para extrair a camada de texto no navegador, página por página. O processamento não envia o PDF a um servidor nem a um provedor de IA. A referência registra o número físico da página no arquivo, que pode ser diferente da numeração impressa no documento.

O arquivo original não é modificado. A extração retorna páginas, páginas sem texto e avisos. Esses dados podem alimentar `createMaterial`, que divide o texto mantendo sua página de origem.

Limites padrão:

- Arquivo de até 10 MB.
- Até 100 páginas.
- Até 300 mil caracteres extraídos.
- Até 30 segundos para a leitura após carregar o motor de PDF.

O aplicativo deve apresentar o erro ao jogador/estudante e permitir tentar outro arquivo, sem criar material aparentemente lido quando a extração falha.

## Limitações importantes

- **Não existe OCR.** PDFs digitalizados ou contendo apenas imagens são recusados quando não há texto extraível. Use OCR fora do aplicativo ou cole texto que tenha autorização para usar.
- Páginas sem texto em um documento misto são listadas em um aviso. Elas podem estar vazias ou conter imagens; não foram interpretadas.
- A ordem extraída pode não reproduzir a ordem visual em documentos com várias colunas, tabelas, diagramas, fórmulas ou fontes complexas. Confira sempre o original antes de aprovar um resumo ou resposta.
- Não há interpretação de imagens, gráficos, manuscritos ou estrutura semântica das tabelas.
- PDFs protegidos por senha pedem uma cópia desbloqueada e autorizada; o aplicativo não remove proteções.
- Validar a assinatura `%PDF-` é somente uma checagem preliminar. O motor PDF.js faz a leitura estrutural, que ainda pode falhar em arquivos corrompidos.
- A existência de uma referência comprova apenas que o trecho está disponível. Não comprova que uma resposta de IA está correta ou é sustentada pelo trecho.

## Distribuição e segurança

O navegador carrega as cópias locais do módulo e worker PDF.js em `vendor/`. Não há CDN envolvida nessa etapa. Preserve a licença de PDF.js ao distribuir esses arquivos e mantenha a dependência atualizada. `isEvalSupported` é desabilitado na abertura do arquivo. Isso reduz uma superfície de execução, mas não é uma garantia de segurança absoluta para arquivos hostis.

Materiais privados não devem ser publicados no repositório ou usados em capturas de demonstração. Enviar posteriormente os trechos extraídos a um provedor de IA é uma etapa diferente, que exige informação clara e configuração apropriada.

## Verificação automatizada

`node --test tests/pdf.test.mjs` usa **PDF.js real**, importado do pacote instalado, para ler PDFs sintéticos mínimos construídos durante o teste com tabela xref válida. Não utiliza documentos pessoais.

A suíte verifica extração e páginas, progresso, arquivo original preservado, documento sem texto, páginas mistas, entradas inválidas e limites de bytes/páginas/caracteres. Apenas o teste de timeout usa um motor controlado que não termina, para verificar deterministicamente o cancelamento e a liberação de recursos.

Os testes em Node não substituem a inspeção do worker e da interface no navegador e não constituem auditoria de segurança do PDF.js.
