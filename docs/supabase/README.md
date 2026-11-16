# Contas gratuitas e sincronização: plano de ativação

## Situação e limites

Preparação técnica em 16/11/2026. Não há login ou sincronização em produção comprovados. O conector Supabase foi encontrado, mas ainda depende de conexão do proprietário; o navegador cloud está na tela de login. Não foram criados projeto, conta, cobranças ou segredos. O aplicativo e seus dados locais não foram alterados.

O plano escolhido é **Free**. Antes de criar o projeto, conferir no painel organização, cota gratuita disponível e valor zero. Se exigir upgrade, interromper, não contratar. A documentação informa 500 MB de banco e 1 GB de arquivos no Free; pausas por inatividade podem afetar disponibilidade. Banco e PDFs têm limites separados, e o backup de banco não contém os arquivos do Storage. Conferir os limites vigentes novamente na ativação.

O SMTP padrão do Supabase não serve para cadastro público geral: restringe envio a endereços autorizados da organização e possui limite reduzido. Configurar SMTP próprio exige credencial, domínio/remetente e autorização; não desativar confirmação de e-mail para contornar essa restrição. Sem configuração, manter login público indisponível e modo local funcional. Não instalar nem contratar SMTP automaticamente.

## Configuração, em ordem

1. Conectar Supabase pelo fluxo oficial. Não enviar senha ou chave secreta pela conversa.
2. Criar projeto **Trilha Viva** em organização Free existente ou gratuita autorizada. Preferir região disponível próxima ao público brasileiro; não prometer residência integral dos dados apenas pela região.
3. Revisar e aplicar em teste a [migração](../../supabase/migrations/202611160001_sync_foundation.sql) somente em projeto novo dedicado, ainda sem abrir acesso aos usuários. A migração é uma fundação incompleta e não um deploy de sincronização. Confirmar RLS ativado, nenhuma política pública de leitura e bucket `study-pdfs` privado.
4. Configurar Auth email/senha, confirmação de email e recuperação. URL do site: `https://luigiscofano.github.io/trilha-viva/`. Usar redirects exatos para as rotas efetivamente implementadas; não habilitar curinga amplo. SMTP externo continua pendente de configuração/autorização separada.
5. Configurar frontend apenas com URL do projeto e **publishable key**. `service_role`/secret key e senha do banco nunca entram no bundle. Fixar versão do SDK e testar antes de integrar; este preparo não adiciona SDK.
6. Implementar cliente separado do adapter local. Sem sessão, apresentar modo local. Login não implica upload de todos os materiais. Mostrar quais dados serão enviados e solicitar ação explícita de migração.
7. Executar testes de segurança, funcionalidade e recuperação abaixo. Só então habilitar o recurso e documentar resultado real, commit e ambiente.

## Contrato para integração do cliente

- Manter `trilha-viva-preview-v1` e o schema local 2 intactos. Nunca renomear/apagar ao fazer login.
- Usar `validateState` e as entidades atuais `materials`, `suggestions`, `tasks`, `history`.
- Persistir o mapa de revisões remoto separadamente, com cache isolado por UID. Ao sair/trocar de usuário, nenhum cache/sessão anterior deve aparecer para o próximo.
- Ler registros apenas da sessão atual (RLS). Salvar cada mudança via RPC `save_study_record`; revisão esperada obrigatória. Conflito 40001 abre comparação, sem sobrescrever silenciosamente.
- A exclusão usa tombstone reversível; um aparelho antigo não pode ressuscitar automaticamente o item. Manter fila offline com estados pendente/sincronizado/conflito/erro. Não prometer salvamento antes do retorno do servidor.
- IDs estáveis e reenvio idempotente: depois de resposta perdida, reler/comparar entidade antes de repetir. Não tratar todo erro 40001 como confirmação.
- A fundação SQL ainda não faz validação completa de referências, cotas individuais ou lote transacional. Esses itens são bloqueadores de liberação, não testes aprovados.

## Migração sem perda

1. Exportar backup local v2 e validar reimportação em memória.
2. Mostrar quantidades e conflitos antes do envio, com opção cancelar. Não transmitir documentos ainda não selecionados.
3. Validar todo o grafo, enviar materiais antes de dependentes, registrar progresso e tratar interrupções sem apagar estado local.
4. Conferir contagens, IDs e referências no resultado remoto. Não substituir cópia local por estado remoto parcial.
5. PDFs originais não existem necessariamente no backup local atual. Pedir reenvio apenas desses PDFs, sem fingir que foram preservados. Guardar objetos em `UID/ID_OPACO.pdf`, máximo 10 MB/arquivo nesta proposta. MIME é limite, não inspeção de conteúdo; validar arquivo antes de uso.
6. Exportar dados sincronizados em formato versionado, diferenciando metadados/texto de PDFs. Backup de PDFs requer exportação separada ou pacote explícito. Nunca chamar JSON sem binários de backup completo dos PDFs.

## Critérios de liberação

- Duas contas reais de teste: A não lê, altera, exclui nem baixa qualquer registro/arquivo de B, por interface ou REST.
- Usuário anônimo não acessa registros nem arquivos. Testar caminho falsificado e URL assinada expirada; links assinados são credenciais temporárias e não devem aparecer em logs.
- Cadastro, confirmação e recuperação realmente entregam email no provedor aprovado. Sessão expirada produz erro claro, sem perda de edições.
- Testar duas abas/dispositivos com revisão antiga, offline/reconexão, troca de conta, login interrompido e importação interrompida.
- Repetir testes de backup/importação e referências. Integrar grafo transacional e quotas antes de liberar multiusuário.
- Testar teclado, foco no modal de login e telas estreitas; preservar tipografia e identidade aprovadas.

## Fontes oficiais

- [Preços e limites](https://supabase.com/pricing)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Políticas do Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Backups](https://supabase.com/docs/guides/platform/backups)

Este documento não é evidência de configuração realizada. Os testes SQL preparados não foram executados: este ambiente não tem psql/Docker e o projeto Supabase ainda não está conectado.
