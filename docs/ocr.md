# OCR local opcional

## O que foi implementado

`src/ocr.mjs` reconhece texto de páginas digitalizadas usando Tesseract.js e a renderização do PDF.js. **Tesseract.js não lê PDFs diretamente**: PDF.js rasteriza as páginas escolhidas, uma por vez, e o OCR recebe a imagem temporária.

O fluxo é explicitamente opcional. A extração de texto nativo continua sendo a primeira opção. Uma falha de extração não inicia OCR nem envia arquivos automaticamente.

A biblioteca é aberta, sem cobrança por chamada. Executar OCR consome CPU, memória e bateria do aparelho. Nenhuma conta ou API externa é necessária. Custos normais de hospedagem e tráfego dos arquivos estáticos continuam dependendo da implantação.

## Integração da interface

```js
import { recognizePdf } from "./ocr.mjs";

const controller = new AbortController();
const result = await recognizePdf(
  new Uint8Array(await selectedFile.arrayBuffer()),
  {
    language: "por", // 'eng' ou 'por+eng' também aceitos
    pageNumbers: [1, 2], // opcional; sem seleção, processa o documento se tiver até 8 páginas
    signal: controller.signal,
    onProgress(event) {
      // phase: loading, initializing, rendering, recognition ou page-complete
      // page/completed/total quando aplicáveis; progress pode vir do engine
      showProgress(event);
    },
  },
);
// Mostre result.warnings e o texto editável antes de persistir.
// result.pages preserva a numeração real: {page,text,confidence,method,needsReview}.
// Botão de cancelar chama controller.abort(). Nenhum resultado é salvo por este módulo.
```

Apresentar aviso antes do início: “OCR executado neste aparelho. Pode levar alguns instantes e cometer erros. Revise o resultado antes de salvar.”

Quando houver mais de 8 páginas, oferecer seleção de páginas ou orientar dividir o arquivo. Não processar silenciosamente apenas o começo. O retorno inclui `selectedPages` e `documentPages`; deixe explícito quais páginas foram e não foram reconhecidas. Se combinar OCR com texto nativo, mantenha os números originais e não sobrescreva páginas já extraídas sem decisão do usuário.

`confidence` é a estimativa do reconhecedor, **não confiança factual nem garantia de precisão**. Texto de baixa confiança ou confiança ausente produz aviso. Toda saída retorna `needsReview: true`. Não tratar texto OCR como se fosse fiel ao original automaticamente.

## Instalação e arquivos de mesma origem

Dependências oficiais utilizadas nesta implementação/teste:

```sh
npm install tesseract.js@7.0.0 @tesseract.js-data/por@1.0.0 @tesseract.js-data/eng@1.0.0
```

Adicionar ao preparo do build, preservando licenças:

```js
await mkdir("vendor/ocr/lang", { recursive: true });
for (const file of ["tesseract.esm.min.js", "worker.min.js"]) {
  await copyFile(
    `node_modules/tesseract.js/dist/${file}`,
    `vendor/ocr/${file}`,
  );
}
await cp("node_modules/tesseract.js-core", "vendor/ocr/core", {
  recursive: true,
});
for (const language of ["por", "eng"]) {
  await copyFile(
    `node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,
    `vendor/ocr/lang/${language}.traineddata.gz`,
  );
}
await copyFile(
  "node_modules/tesseract.js/LICENSE",
  "vendor/ocr/TESSERACT-LICENSE.txt",
);
await copyFile(
  "node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt",
  "vendor/ocr/TESSERACT-NOTICES.txt",
);
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt",
  "vendor/ocr/WORKER-NOTICES.txt",
);
```

As importações de `mkdir`, `copyFile` e `cp` vêm de `node:fs/promises`. O preparo PDF.js existente deve continuar copiando `standard_fonts`, `cmaps` e `wasm`. O build deve copiar `vendor/` e `src/ocr.mjs`.

`browserOcrAssetUrls()` calcula todos os caminhos a partir da localização do módulo, preservando implantação em subdiretório como GitHub Pages. `workerPath`, `corePath` e `langPath` são sempre explícitos: **não existe fallback intencional para CDN**. Ausência de arquivos, engine ou WebAssembly deve resultar em erro honesto, não saída simulada.

Nesta versão, o diretório completo de core ocupa aproximadamente 44 MB no disco, pois inclui variantes de compatibilidade; o navegador seleciona a variante necessária em vez de baixar todas. Os dados compactos escolhidos ocupam aproximadamente 1,4 MB (português) e 2,9 MB (inglês), comprimidos. Eles carregam somente quando o OCR é solicitado. Não pré-carregar os modelos na abertura do site.

## Limites e cancelamento

- Até 10 MB por arquivo PDF.
- Até 100 páginas no documento, com **8 páginas por operação OCR**.
- Rasterização limitada a 4 milhões de pixels por página e escala máxima 2.
- Até 100 mil caracteres reconhecidos por operação.
- Timeout total de 120 segundos.
- Apenas um reconhecedor, páginas processadas sequencialmente.
- Um worker supervisor permite interromper a inicialização e os workers filhos; `AbortController` encerra a operação.
- Documento PDF, worker e imagens temporárias são liberados no término, erro ou cancelamento.

Qualquer UI deve evitar operações concorrentes ilimitadas e sempre manter Cancelar disponível. No cancelamento, não salvar resultados parciais como se o documento estivesse completo.

## Privacidade e limitações

PDF e imagens temporárias ficam na memória local. Não há envio ao provedor de IA nem upload para OCR. O módulo não persiste texto ou arquivos; a interface controla o salvamento após revisão. O download de assets estáticos é feito à mesma origem do site. O cache persistente de modelos do Tesseract foi desabilitado (`cacheMethod: 'none'`) nesta implementação.

OCR pode errar acentos, equações, tabelas, colunas, diagramas, manuscritos e fotos desfocadas. Não há correção automática de sentido. PDFs com senha precisam ser desbloqueados pelo usuário autorizado antes do uso. Se nenhuma página tiver texto reconhecido, a operação falha explicitamente. Páginas vazias em resultado misto são identificadas em `emptyPages` e `warnings`.

Não foi verificada compatibilidade em todos os aparelhos. Navegadores sem Web Workers/WebAssembly recebem mensagem de indisponibilidade. Computadores e celulares modestos podem atingir o timeout, mesmo com arquivos válidos. Os limites não são promessa de rapidez.

## Testes

`tests/ocr.test.mjs` verifica seleção de páginas, referências originais, estado de revisão, ausência de texto, avisos de baixa confiança, tamanho, caracteres, cancelamento, timeout, engine indisponível e caminhos da mesma origem.

Há também um teste real: PDF sintético → rasterização com PDF.js/canvas → Tesseract.js com dados de inglês locais → reconhecimento de “LEARNING IS A JOURNEY”. Não chama serviço de OCR. Se as dependências não estiverem instaladas, esse teste fica explicitamente pulado, não declarado aprovado. Nesta execução, as dependências foram instaladas em um diretório temporário isolado para não conflitar com o trabalho do integrador; todos os 11 testes passaram, incluindo o teste real, usando `TRILHA_OCR_MODULE_ROOT` apontando para esse diretório. Após instalação no projeto, executar normalmente `node --test tests/ocr.test.mjs`.

Na integração, o responsável pelo app verificou também o OCR real pela interface no navegador, incluindo o worker supervisor: um PDF sintético de duas páginas retornou “Material ficticio: a agua evapora.” e “O vapor pode condensar.”. O resultado foi revisado e salvo como material. Essa evidência não equivale a uma auditoria de todos os aparelhos. Antes de declarar a funcionalidade publicada, conferir carregamento dos arquivos, cancelamento e ausência de requisições a terceiros no navegador da implantação final.

## Referências oficiais consultadas

- https://github.com/naptha/tesseract.js
- https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
- https://github.com/naptha/tesseract.js/blob/master/docs/api.md
- https://github.com/naptha/tesseract.js/blob/master/docs/performance.md
- https://mozilla.github.io/pdf.js/examples/
