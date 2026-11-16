# Tipografia A aprovada

- **Títulos semânticos h1–h6:** Manrope Variable.
- **Corpo, navegação, menus, campos, botões, diálogos:** DM Sans Variable, herdada da raiz. Controles usam `font: inherit`.
- **Fallback:** system-ui, sans-serif. A logo B permanece a arte aprovada.
- **Acentos:** subsets Latin e Latin Extended; exemplos: “Revisão”, “Configurações”, “Ação”, “órgão”.
- **Privacidade:** arquivos locais WOFF2 servidos pela mesma origem. Não há Google Fonts/CDN externo. `scripts/prepare-vendor.mjs` copia arquivos e licenças OFL de dependências com versão fixada.
- **Carregamento:** swap evita texto invisível. Apenas fontes/subsets utilizados são carregados pelo navegador. O itálico real de DM Sans também está disponível.
- **Coesão:** tokens `--font-heading` e `--font-body` em src/style.css, compartilhados por todas as rotas. Não adicionar fontes isoladas em páginas.
- **Verificação:** testes de contratos da CSS/build e suíte funcional. Verificação visual deve observar 390 px e desktop, foco, menus e texto acentuado. Nenhuma regra de negócio ou dado foi alterado.
