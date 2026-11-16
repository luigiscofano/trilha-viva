# API de IA opcional, local e desativada por padrão

O backend é executável e foi testado com **mocks locais**, não com chamadas reais ao n8n ou a uma API de IA. Não há contas criadas, serviços conectados ou gastos realizados. O frontend estático funciona sem ele, com estado de IA não configurada.

## Executar sem serviço externo

```sh
npm run build
node server/study-server.mjs
# interface e API em http://127.0.0.1:8787
```

O processo serve apenas os arquivos do `dist/`, com extensões permitidas. Por padrão `AI_PROVIDER=unconfigured`; `/api/study` retorna 503 e não envia material para fora. A escuta é somente loopback, não rede pública. `PORT` ajusta a porta; ajustar também a origem exata.

## Contrato

- `GET /api/status`: `{configured, provider, requiresAuthentication:true}`. Não devolve tokens, webhook ou chaves. GET da mesma origem não exige header Origin; origem explícita diferente é recusada.
- `POST /api/study`: `Content-Type: application/json`, `Origin` exatamente igual à origem configurada, `Authorization: Bearer TOKEN_DE_OPERADOR`.
- Corpo: `{schemaVersion:1, materialId, title, chunks:[{id,page,text}]}`. Página é inteiro positivo ou `null`; não inventar números. Campo `instructions` do cliente é ignorado; o servidor usa seu próprio prompt.
- Sucesso: `{schemaVersion:1,suggestions:[...],insufficientEvidence:boolean}`. Sugestões são forçadas a `pending`; uma resposta de IA nunca aprova a si mesma.
- Erro: `{error:{code,message}}`. Estados: 400 entrada inválida, 401 sem autenticação, 403 origem recusada, 413 tamanho, 415 tipo, 429 limite, 502 upstream/referências inválidas, 503 não configurado, 504 timeout.

O cliente deve informar **antes do envio** que os trechos do material escolhido irão ao operador do backend, à instância n8n quando habilitada e ao provedor de IA. Exigir ação explícita. Nenhum material é enviado somente ao abrir a aplicação.

## Configuração autorizada no servidor

| Variável | Uso |
|---|---|
| `AI_PROVIDER` | `unconfigured` (padrão), `n8n` ou `openai` |
| `TRILHA_ALLOWED_ORIGIN` | Origem exata, padrão `http://127.0.0.1:8787`. HTTPS fora de localhost. Sem wildcard. |
| `TRILHA_ACCESS_TOKEN` | Token aleatório mínimo 32 caracteres. Autenticação de operador, não chave do provedor. |
| `N8N_WEBHOOK_URL` | Webhook HTTPS da instância autorizada, apenas modo n8n |
| `N8N_SHARED_SECRET` | Segredo diferente para autenticar backend→n8n, mínimo 32 caracteres |
| `AI_API_KEY` | Chave do provedor, somente modo openai |
| `AI_MODEL` | Modelo disponível e aprovado na conta; não existe modelo pago implícito |
| `TRILHA_REQUESTS_PER_MINUTE` | Padrão 5, máximo 30 por processo |
| `TRILHA_TIMEOUT_MS` | Padrão 25000, máximo 60000 |
| `TRILHA_STATIC_DIRECTORY` | Diretório de build estático, padrão `dist` |

Use gerenciador de segredos ou ambiente do processo. Não commitar `.env`, colocar tokens no código, URLs, logs, screenshots ou frontend. O modo n8n é descrito em `integrations/n8n/README.md`.

O modo direto chama somente `https://api.openai.com/v1/chat/completions`, com modelo explícito, JSON mode e limite de 3000 tokens de saída. Uma chave real implicará custo por uso conforme provedor/modelo. Preços e autorização precisam ser verificados antes de habilitar. Não houve teste real do provedor; compatibilidade de modelo deve ser confirmada.

## Autenticação: limite importante

Este servidor é um **backend pessoal/local**, não um sistema multiusuário pronto para produção. O token de operador pode ser inserido por quem controla o backend, mantido apenas na memória da sessão e apagado ao recarregar. Ele **não** é uma chave de IA, mas ainda permite gastar a cota do backend: não distribuí-lo publicamente.

Uma publicação multiusuário exige autenticação real, sessões, autorização individual, limites e orçamento por usuário e isolamento. Não embutir um token compartilhado na página pública. Uma alternativa é um proxy autenticado da mesma origem que injete a credencial somente após verificar a sessão. GitHub Pages sozinho não executa esse backend nem guarda segredos. A aplicação estática não deve fingir IA conectada por estar publicada.

## Limites e privacidade

- Corpo até 450 KB; até 300 trechos, cada um com até 1800 caracteres; total até 300 mil caracteres.
- Resposta até 512 KB, até 30 sugestões; validação de IDs/páginas obrigatória.
- Até duas requisições externas simultâneas e limite por minuto, em memória. Não é controle distribuído nem limite financeiro garantido. Configure limites de gastos no provedor separadamente.
- Timeout e redirects recusados; sem retentativas automáticas que possam duplicar cobranças.
- Nenhum texto, token ou resposta é escrito em log/arquivo pelo código. O processo/provedor podem ter logs próprios; revisar retenção antes de usar materiais privados.
- Referência estruturalmente válida não garante resposta correta. Conteúdo exige revisão humana.
- Não há execução de comandos extraídos do material nem ferramentas de ação conectadas ao modelo.

## Testes

`node --test tests/server.test.mjs` usa somente servidor loopback e `fetchImpl` simulado. Verifica estado ausente, configuração, origem, token, conteúdo, tamanho, limite de requisições, timeout, segredo não exposto, resposta n8n e resposta OpenAI simuladas, recusa de página inventada e status. Não é evidência de execução em serviços externos.

## Importação restrita de texto por URL

A rota opcional `POST /api/import-link` utiliza a mesma origem, token e limites da API. É independente do provedor IA, desabilitada por padrão e ainda sem controle na interface. Aceita apenas texto público UTF-8 de domínios explicitamente autorizados; não HTML/PDF remoto. Detalhes, consentimento, DNS/IP fixado e limitações de segurança em [importacao-links.md](importacao-links.md).

## Endurecimento do servidor estático e concorrência

O servidor rejeita arquivos em diretórios ocultos e verifica o caminho real de links simbólicos antes de servir o build. Links para fora da pasta pública, arquivos ocultos ou destinos de outra extensão são recusados. Isso evita exposição acidental de arquivos privados por aliases no build. A pasta de publicação deve continuar sendo produzida por código confiável e não pode ser modificada por usuários externos enquanto é servida; a verificação não é um isolamento de filesystem contra um processo local hostil concorrente.

Respostas não são escritas em conexões já encerradas. Testes locais verificam também que o teto de duas chamadas simultâneas bloqueia uma terceira e que falhas do serviço liberam as vagas. Os testes usam respostas simuladas e não ativam nenhum serviço de IA.
