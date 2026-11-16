# Testes Supabase

`isolation.sql` usa transação e rollback com dois IDs fictícios. Executar com administrador apenas em banco de teste dedicado após a migração. Confere RLS SELECT e conflitos de revisão via RPC. Não executado neste ambiente: sem psql, Docker ou projeto conectado.

Ainda obrigatórios: autenticação real de A e B, tentativas REST de leitura/escrita cruzada, acesso anônimo, Storage upload/download e URLs assinadas, confirmação/reset de email, limite de arquivos, expiração de sessão, duas abas/dispositivos, importação interrompida e recuperação do backup. Nunca usar dados pessoais nos testes públicos.
