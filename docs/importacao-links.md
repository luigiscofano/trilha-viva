# Importação de links: escopo deliberadamente restrito

## Estado real

Há um módulo de servidor e uma API opcional testados com transporte/DNS simulados. Não houve acesso externo real. A interface não ganhou um botão de importação nesta etapa; o fluxo precisa ser integrado e testado no navegador antes de ser anunciado como disponível ao jogador. O servidor não persiste nem envia esse texto à IA automaticamente.

Não é um navegador nem um extrator genérico de artigos. Por enquanto aceita **somente arquivos públicos `text/plain` UTF-8**, no máximo 300.000 bytes. HTML, PDF remoto, compressão, login, cookies, CAPTCHA, URLs com parâmetros e redirecionamentos são recusados. Para PDF, continue usando o upload local existente. Não contorna paywalls ou restrições do editor.

## Configurar conscientemente

1. Verifique que você tem direito de importar o material e que o editor permite o acesso automatizado. O software não pode determinar licenças nem autorização jurídica sozinho.
2. No `.env` privado do servidor, defina `TRILHA_IMPORT_HOSTS` com domínios exatos separados por vírgula, por exemplo `materiais.example.org`. Nenhum domínio real é habilitado por padrão. Não há curingas nem autorização automática de subdomínios.
3. Gere `TRILHA_ACCESS_TOKEN` forte com pelo menos 32 caracteres. A mesma proteção de origem e token da API de estudos é obrigatória, mesmo se `AI_PROVIDER=unconfigured`.
4. Sirva a interface e a API na mesma origem. Não habilite serviço público multiusuário usando um único token compartilhado. Consulte [backend](backend.md).
5. Teste primeiro um texto fictício de sua propriedade. Nenhuma configuração ativa é enviada ao GitHub.

## API

`POST /api/import-link`, com `Origin`, `Content-Type: application/json` e `Authorization: Bearer <token de operador>`. O token deve permanecer em memória, não no backup ou no bundle.

```json
{"url":"https://materiais.example.org/aula.txt","consent":true}
```

A confirmação significa: a pessoa tem permissão para importar e sabe que a URL será enviada ao backend, que acessará o servidor de origem. A fonte verá IP e agente HTTP do backend. O navegador deve obter confirmação real, não enviar `consent:true` silenciosamente. Mesmo uma URL sem query pode conter dados pessoais no caminho: não usar documentos privados ou URLs secretas.

Resposta:

```json
{"schemaVersion":1,"sourceUrl":"https://materiais.example.org/aula.txt","text":"Texto extraído...","page":null,"requiresReview":true}
```

A UI futura deve exibir a origem e permitir revisar o texto antes de salvar como material. Não inventar paginação. Conteúdo retornado é texto não confiável, nunca HTML a inserir via `innerHTML` nem instruções para executar. O envio posterior à IA continua sendo uma ação separada com seu próprio consentimento.

## Defesas e limites

- Somente HTTPS na porta padrão; certificados e hostname TLS continuam validados por Node.
- DNS resolvido uma vez; todos os endereços retornados precisam ser IPv4 públicos. Endereços privados, loopback, link-local, multicast, documentação e faixas reservadas listadas no módulo são recusados.
- **IPv6 é recusado nesta etapa**, inclusive uma resposta DNS mista IPv4/IPv6. Isso reduz compatibilidade deliberadamente.
- A conexão fixa o IP validado via `lookup`, sem nova consulta DNS nem pool reaproveitado (`agent:false`), preservando o hostname para SNI/certificado. Isso bloqueia o padrão de DNS rebinding entre validação e conexão.
- Não segue redirecionamento, não envia cookies, Authorization ou cabeçalhos recebidos do navegador para a fonte.
- Timeout total de 10 segundos incluindo DNS; limite do corpo aplicado mesmo sem Content-Length; sem descompressão e sem reintento.
- Mesmo rate-limit e teto de duas requisições simultâneas da geração de estudos. Contadores são locais ao processo, não defesa distribuída.
- URL/texto não são registrados pelo módulo. Proxy, hospedagem e provedor DNS podem ter logs próprios.

Isso não é garantia absoluta contra SSRF em toda infraestrutura. Um servidor com rotas customizadas, proxy transparente ou rede especial pode alcançar recursos internos por IPs aparentemente públicos. Em implantação real, adicione **firewall de saída** bloqueando redes internas/serviços de metadados, mantenha Node atualizado e revise a allowlist. Não há entrada arbitrária de URL do usuário para provedores externos; destinos da integração IA também são configuração do operador.

## Testes

`node --test tests/server-link.test.mjs`: allowlist, URLs inválidas, redes privadas, DNS misto, IP fixado, consentimento, redirects, MIME/compressão, tamanho, UTF-8 inválido, timeout DNS e autenticação da rota. Mocks não substituem teste end-to-end em hospedagem real nem auditoria de segurança externa.
