# Migrações

`202611160001_sync_foundation.sql` é uma migração única e transacional para projeto novo exclusivo do Trilha Viva. Não executar em projeto compartilhado sem revisão de nomes e políticas. Não usar `IF NOT EXISTS` para mascarar divergência de esquema. Registrar hash aplicado e resultado. Não reaplicar manualmente após sucesso.

A migração não ativa cadastro público, não importa dados locais, não contrata serviços e não publica frontend. RLS e limites adicionais precisam de testes antes da liberação. Um rollback operacional deve preservar registros e arquivos, não executar DROP sobre dados de usuários.
