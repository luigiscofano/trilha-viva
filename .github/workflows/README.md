# Qualidade e publicação

`quality-pages.yml` usa Node 24, instalação pelo lockfile, testes, sintaxe e build. PRs não publicam. Após merge em main, publica `dist` em GitHub Pages. Não executa o backend nem ativa serviços externos. Falhas são consultáveis em Actions antes de confirmar publicação.
