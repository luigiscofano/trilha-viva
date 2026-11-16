# Trilha Viva

Uma plataforma de estudos para reunir materiais, conferir referências, preparar revisões e acompanhar pequenos passos de aprendizado. A IA é uma ajuda opcional: **conteúdo sugerido precisa ser revisado por uma pessoa antes de ser aceito**.

A direção azul, a logo **B · Páginas** e os ícones foram aprovados pelo responsável pelo projeto. A identidade utiliza contraste, superfícies claras e luz discreta; não utiliza a marca do Hospital Einstein nem elementos do Intuição.

## O que funciona e o que depende de configuração

| Recurso | Estado real |
|---|---|
| Painel, biblioteca, revisão, plano e configurações | Implementados na aplicação local |
| Entrada de texto e separação em trechos de origem | Implementadas |
| PDF com texto: extração local e referências de página | Implementada com PDF.js; sem OCR |
| PDF vazio, parcialmente legível ou excessivo | Erros/avisos e limites explícitos |
| Tópicos, resumos e perguntas manuais | Cadastro com referências e revisão humana |
| Sugestões: editar, aceitar, descartar e consultar histórico | Implementadas |
| Plano: criar tarefa, editar material/data, concluir e reabrir | Implementado |
| Persistência e backup exportável/importável | Implementados, com esquema e validação de conflitos |
| Geração de IA | Cliente e backend opcionais implementados; **nenhum provedor real foi conectado ou chamado nesta entrega** |
| n8n | Template inativo e guia de configuração; **não importado nem executado em uma instância** |
| Make/Zapier | Alternativas documentadas para uma etapa pequena; **não configuradas nem utilizadas** |
| v0/Bolt/Cursor | Uso sugerido e pontos de entrada documentados; **não utilizados nesta implementação** |
| Links externos, OCR, contas e sincronização | Não implementados |
| E-mails e notificações automáticas | Não enviados; não há automação ativada |

Os materiais iniciais de ecologia, estatística e pensamento computacional são textos fictícios criados para a demonstração. As sugestões editoriais de exemplo não são apresentadas como resultados de uma chamada real de IA.

## Referências visuais aprovadas

Estas imagens registram a direção visual aprovada, não são comprovantes de execução de integrações externas:

![Painel: referência visual azul aprovada](docs/previas/06-painel-azul.jpg)

![Revisão com fonte ao lado: referência aprovada](docs/previas/07-revisao-azul.jpg)

As primeiras imagens verdes em `docs/previas/01-*` a `05-*` são histórico de uma proposta rejeitada. Não representam o design adotado. A interface funcional está em `index.html`; arquivos `design-*.html` são pranchas históricas de comparação, com controles ilustrativos.

## Início rápido

Requisitos: Node.js **22.13+ ou 24**, npm e navegador moderno com módulos JavaScript, Web Workers e armazenamento local. A versão 24 foi usada nos testes desta entrega.

```sh
npm ci
npm run dev
# abrir http://127.0.0.1:4173
```

O servidor de desenvolvimento serve o frontend. Se não existir backend nessa origem, a aplicação informa IA não configurada; materiais, revisões manuais, tarefas e backups continuam funcionando.

```sh
npm test        # testes automatizados
npm run check  # verificação sintática configurada no projeto
npm run build  # produz dist/ para hospedagem estática
```

Em ambiente gerenciado com serviço próprio de prévia, utilize o comando de prévia da plataforma em vez de iniciar servidores concorrentes.

### Frontend e backend opcional na mesma origem

```sh
npm run build
npm start
# abrir http://127.0.0.1:8787
```

Por padrão o backend permanece desativado para IA (`AI_PROVIDER=unconfigured`). Ele atende a interface construída e as rotas `/api/status` e `/api/study`, sem chamar serviços externos.

Para configurar posteriormente, copie `.env.example` para um arquivo privado `.env`, preencha apenas após autorização de credenciais/custos e execute:

```sh
node --env-file=.env server/study-server.mjs
```

`npm start` não carrega `.env` automaticamente: ele lê as variáveis já exportadas no ambiente. O comando acima carrega o arquivo explicitamente. Nunca publique `.env` ou coloque chaves do provedor no frontend.

**Leia [docs/backend.md](docs/backend.md) antes de habilitar IA.** O servidor fornecido é pessoal/local, não uma infraestrutura multiusuário pronta para publicação. GitHub Pages não executa esse backend nem armazena segredos.

## Como usar

1. Em **Materiais**, adicione um texto autorizado ou um PDF legível. Confira os trechos e páginas extraídos.
2. Em **Revisões**, crie uma anotação manual, resumo ou pergunta com referência ao material. Exemplos editoriais permitem conhecer o fluxo sem usar IA.
3. Se houver backend autorizado, configure o token de operador da sessão em **Dados e integrações**. Nunca cole ali uma chave de API do provedor.
4. Ao gerar com IA, selecione um material e confirme o envio. O texto, título e referências do material escolhido serão transmitidos ao backend da mesma origem e ao provedor configurado, passando pelo n8n quando esse modo estiver habilitado.
5. Compare cada sugestão com sua fonte; edite, aceite ou descarte. Referência válida não garante conclusão correta.
6. Organize datas e tarefas em **Plano de estudos**. Nenhum e-mail ou notificação é enviado.
7. Exporte regularmente um backup em **Dados e integrações**.

## Arquitetura

```text
Navegador
 ├─ materiais, PDF.js local, trechos e referências
 ├─ revisão humana, plano, progresso e backup
 └─ envio explícito opcional → API da mesma origem
                               ├─ validação, autenticação e limites
                               ├─ n8n autorizado → provedor de IA
                               └─ ou provedor configurado diretamente
```

| Arquivo/pasta | Responsabilidade |
|---|---|
| `src/core.mjs` | Funções puras, esquema versionado, materiais, referências, revisão, tarefas e backups |
| `src/app.mjs` | Orquestração da interface e interações |
| `src/ui-helpers.mjs` | Ícones, escaping e utilidades de apresentação |
| `src/brand.mjs` | Identidade visual aprovada e ilustração de aprendizado |
| `src/demo.mjs` | Dados fictícios da demonstração |
| `src/style.css` | Tokens azuis, componentes e responsividade |
| `src/pdf.mjs` | Extração local limitada, avisos e cancelamento |
| `src/ai-client.mjs` | Estado da integração e chamadas autorizadas da sessão |
| `src/ai-contract.mjs` | Contrato e validação das sugestões recebidas |
| `server/study-server.mjs` | Backend opcional, arquivos estáticos e proteção das chamadas |
| `integrations/n8n/` | Template inativo e instruções; não equivale a execução real |
| `tests/` | Testes Node do núcleo, PDF, cliente, contrato e servidor |
| `scripts/` | Preparação de dependências locais e build |
| `docs/` | Integrações, PDF, backend, limites e evidências de validação |

PDF.js e seus recursos são copiados da dependência instalada para `vendor/`, junto da licença, durante preparo/build. Não há CDN de PDF nem envio automático do arquivo. A tipografia solicita **Manrope ao Google Fonts**, com fallback do sistema; isso é uma conexão externa para fontes, não para documentos ou IA. Hospedagem local de fontes pode ser adotada em uma etapa posterior, com os arquivos e licença correspondentes.

## Dados, privacidade e backup

Materiais, sugestões e tarefas ficam em `localStorage`, sob a chave legada `trilha-viva-preview-v1`. A chave foi preservada para não descartar dados de testes anteriores. Não há conta, sincronização ou promessa de armazenamento inviolável. Limpar o navegador, mudar de aparelho ou usar modo privado pode causar perda de acesso ao progresso. Dados da mesma origem podem ser lidos pelo código dessa origem; não é um cofre para documentos sensíveis.

O backup JSON contém textos completos. Exporte-o antes de limpar o navegador e guarde-o em local privado. Para restaurar, use **Importar arquivo** em Dados e integrações. A importação valida versão, tipos, IDs e referências; registros novos são mesclados e conflitos não são sobrescritos silenciosamente. Se os dados locais estiverem corrompidos, a aplicação bloqueia a sobrescrita e oferece a cópia original para recuperação.

Tokens de operador ficam apenas na memória da aba, não no backup ou armazenamento local. A chave de IA e o segredo backend→n8n ficam somente no servidor/instância autorizada. O backend não grava documentos, respostas ou segredos em logs; a infraestrutura e o provedor podem possuir políticas próprias de retenção, que precisam ser revisadas antes de usar dados privados.

## IA, custos e ferramentas

Nenhuma chamada real de IA, contratação ou pagamento foi efetuado para esta entrega. Ativar um provedor pode gerar cobrança. Antes disso, confira o modelo/plano, preços, limites de gasto, retenção e autorização do responsável. O limite técnico de chamadas da API não equivale a um teto financeiro garantido.

- [Guia das ferramentas e comparativos](docs/integracoes.md): distingue utilização real de preparação.
- [API, autenticação e configuração](docs/backend.md): todas as variáveis e limitações de publicação.
- [n8n: importação e credenciais](integrations/n8n/README.md): template inativo, sem segredos ou evidência falsa de execução.
- [Extração de PDF](docs/pdf.md): limites, páginas e ausência de OCR.

Make e Zapier não são dependências artificiais do produto: o plano é comparar uma mesma etapa opcional em ambientes de teste, sem duplicar fluxos em produção. v0 e Bolt podem fornecer propostas comparáveis; Cursor pode apoiar revisão/desenvolvimento, quando houver acesso real. Nenhum desses nomes é usado como alegação de experiência desta execução.

## Qualidade, acessibilidade e limites

Foram executados **41 testes automatizados** nesta etapa. São testes do núcleo, PDF sintético real com PDF.js, contrato/cliente de IA e backend com mocks locais. Testes de mock não provam conectividade com serviços externos. A verificação final de UI e publicação deve registrar suas próprias evidências em [docs/validacao.md](docs/validacao.md).

A interface prepara navegação por teclado, rótulos, foco visível, regiões de status e preferência por movimento reduzido. Não é uma declaração de conformidade WCAG nem de teste em todos os aparelhos. A extração de PDF não interpreta imagens e pode precisar de conferência em documentos complexos. Não há importação de links, pois acesso, permissões, CORS e segurança ainda precisam de implementação específica.

## GitHub e implantação

O repositório público deve conter somente código, dados fictícios e documentos higienizados. `node_modules/`, `vendor/`, `dist/`, `.env` e logs estão ignorados; a dependência e os recursos de distribuição são reconstruídos com `npm ci` e `npm run build`.

Branches/PRs devem representar mudanças reais e ser integrados após testes: base local, interface aprovada, PDF/referências, backend opcional, documentação e implantação. Não inventar PRs ou integrações apenas para aumentar o histórico. A lista e os links dos PRs efetivamente criados devem ser verificados no GitHub, não inferidos das propostas anteriores.

Para hospedagem estática, publique o conteúdo de `dist/`. Os recursos locais funcionam; IA continuará indisponível sem backend seguro na mesma origem. Para habilitar backend público, planeje separadamente autenticação multiusuário, isolamento de dados, segredos, HTTPS e orçamento por usuário. Não publique um token de operador compartilhado dentro da página.
