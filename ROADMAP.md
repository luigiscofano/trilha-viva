# Evolução e próximos passos

[Apresentação](README.md) · [Documentação](docs/README.md) · [Validação](docs/validacao.md) · [Histórico de PRs](https://github.com/luigiscofano/trilha-viva/pulls?q=is%3Apr+is%3Amerged) · [Execuções](https://github.com/luigiscofano/trilha-viva/actions)

Este roteiro separa funcionalidades documentadas, preparação técnica e critérios para entregas futuras. Não representa promessa de prazo nem substitui os resultados de uma execução identificada por commit.

## O que já tem evidência no repositório

| Área | Entrega documentada | Onde verificar |
| --- | --- | --- |
| Estudo local | Materiais, edição humana, referências, tarefas e histórico | [README](README.md), [núcleo e interface](src/README.md) |
| PDF e OCR | Extração de páginas e OCR local opcional, com revisão do texto | [PDF/OCR](docs/pdf.md), [testes](tests/README.md) |
| Segurança dos dados locais | Migração de backup e validação antes da importação | [Validação](docs/validacao.md), [testes](tests/README.md) |
| Calendário | Exportação ICS com lembretes opt-in; sem envio automático | [Lembretes](docs/lembretes.md) |
| Interface | Identidade azul, fontes locais e comportamento responsivo | [Tipografia](docs/tipografia.md), [imagens](docs/images/README.md) |
| Publicação | Site estático no GitHub Pages; backend opcional separado | [Backend](docs/backend.md), [Actions](https://github.com/luigiscofano/trilha-viva/actions) |

O registro de validação contém etapas históricas com 41, 70, 72 e 86 testes. São resultados registrados de revisões diferentes, **não uma nova execução feita para escrever este roteiro**. A CI do commit consultado é a fonte adequada para saber se a revisão atual passou. Uma captura da interface também não comprova uma integração externa.

## Próximas entregas e critérios de aceite

| Frente | Estado | Evidência necessária para concluir |
| --- | --- | --- |
| Contas e sincronização | Preparação Supabase; não ativada | Aplicar a configuração autorizada, verificar isolamento entre duas contas, sessão, recuperação e migração opcional sem perda do backup local |
| IA conectada | Contratos e backend opcional; serviço real não comprovado | Configuração autorizada sem segredos públicos, consentimento para envio de trechos, referências válidas, limites de custo e tratamento de indisponibilidade |
| n8n | Fluxo de exemplo, não execução produtiva | Importar em ambiente autorizado, configurar credenciais fora do Git, executar material fictício e registrar entrada/saída higienizadas |
| Make e Zapier | Alternativas documentadas | Demonstrar uma etapa equivalente, sem executar os três fluxos em duplicidade |
| v0, Bolt e Cursor | Uso não realizado nesta implementação | Registrar apenas uma utilização real, sua contribuição e o que foi alterado depois; não adicionar marcas como prova |
| Acessibilidade | Recursos preparados; auditoria integral pendente | Testar teclado, leitor de tela, foco, contraste e movimento reduzido, com cenários e resultados |
| Compatibilidade | Chromium e cenários documentados | Validar Safari/iOS e outros dispositivos reais; registrar viewport, versão e limitações |
| OCR complexo | Demonstrações sintéticas verificadas | Avaliar documentos autorizados com colunas, rotação e baixa qualidade, mantendo revisão humana e fonte original |

[Supabase](docs/supabase/README.md) e [integrações](docs/integracoes.md) detalham dependências e limites. Nenhuma etapa deste roteiro autoriza gastos, conexão de serviços ou envio de documentos privados.

## Como registrar uma entrega real

1. Abrir uma branch temática para uma mudança concreta e explicitar no PR o problema, escopo e limitações.
2. Vincular a implementação, os testes relevantes e o commit validado. Não reutilizar contagens antigas como se fossem atuais.
3. Executar os comandos documentados de teste, sintaxe e build; registrar também o que não foi possível testar.
4. Conferir importação/exportação e preservação dos dados, além de teclado e tela estreita quando a interface mudar.
5. Integrar após revisão e confirmar o deployment antes de declarar o recurso publicado.
6. Criar uma release somente quando houver um marco funcional coerente, com diferenças, limitações, instruções de migração e referência ao commit. Não gerar versões, commits ou PRs vazios para inflar atividade.

## Limites que permanecem visíveis

- Fechar uma janela normalmente não deveria apagar o armazenamento local, mas limpeza do navegador, modo privado e troca de aparelho podem fazê-lo. Exporte backups.
- GitHub Pages não executa o servidor de IA e não fornece contas ou sincronização.
- OCR e sugestões podem errar; o material de origem e a revisão humana continuam necessários.
- Os dados demonstrativos públicos não devem conter documentos privados, credenciais ou backups pessoais.
