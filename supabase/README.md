# Supabase: fundação de contas e sincronização

**Estado: preparação, não ativado.** A migração ainda não foi executada em Supabase. Não há projeto, URL, chave pública ou SMTP configurados por este trabalho. O site continua local; não anuncia login funcional.

- [Migração inicial](migrations/202611160001_sync_foundation.sql): isolamento RLS, escrita com comparação de revisão, exclusão lógica, bucket PDF privado.
- [Testes de isolamento](tests/isolation.sql): dois usuários fictícios, privacidade de registros e conflito de escrita. Não substituem testes reais de login e Storage.
- [Plano de configuração e validação](../docs/supabase/README.md).

A tabela guarda **cada entidade separadamente**, nunca uma cópia do estado inteiro que sobrescreve outro aparelho. `payload` preserva os objetos do schema local v2; o cliente deve validar com `validateState`. O banco verifica dono, tipo, ID, tamanho e revisão; **não valida ainda as referências semânticas de todo o grafo**. Não usar este estágio como liberação pública de sincronização. Uma etapa posterior deverá validar relações/limites por usuário e importação completa de forma transacional.

O único caminho de escrita é `save_study_record(collection, id, payload, expectedRevision, deleted)`. Uma nova entidade usa revisão 0; uma alteração usa a última revisão lida. A função deriva o usuário autenticado e não aceita owner_id. Conflitos retornam `40001` e exigem reconciliação, nunca tentativa automática que apaga a versão remota. `deleted=true` é marcador reversível; não apaga o conteúdo fisicamente.

A chave pública não concede acesso sozinha aos registros: uma sessão válida e suas políticas são necessárias. Nunca colocar `service_role`, senha do banco ou chave secreta no frontend, backup, log ou README.
