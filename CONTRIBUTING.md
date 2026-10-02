# Como contribuir com a viewport-safe

Achou um problema na skill ou quer melhorar algo? Ótimo. Este guia mostra o caminho para a correção entrar sem quebrar o que já funciona.

## Tudo pelo Claude Code (o caminho normal)

A skill fica clonada em `~/viewport-safe` (a pasta do seu usuário), e você fala com o Claude Code em linguagem normal. Três pedidos cobrem tudo:

**1. Instalar (uma vez):**
> Clone https://github.com/rissardi1/viewport-safe em ~/viewport-safe, rode `node scripts/install.mjs --user` dentro dela e depois o `doctor.mjs` da skill instalada. Me diga se terminou com "All good" e se preciso reiniciar o Claude Code.

**2. Só relatar um problema** (não muda arquivo nenhum):
> A viewport-safe errou aqui: [o que você pediu e o que aconteceu]. Monte o link de issue pré-preenchido do repo viewport-safe com o tamanho da janela e o caminho do relatório da auditoria.

O agente devolve um link; é só abrir, conferir e clicar em "Submit new issue".

**3. Corrigir:**
> Em ~/viewport-safe, faça um `git pull`, crie uma branch e corrija este problema na viewport-safe: [descrição]. Siga o CONTRIBUTING.md: teste, CHANGELOG e `doctor`. Depois faça push da branch e me dê o link para abrir o pull request.

O agente cria a branch, mexe na skill, roda os testes e faz o push. Você abre o link que ele devolver e clica em "Create pull request". Para dar `push` você precisa de acesso de escrita ao repositório; sem ele, faça um fork e peça o mesmo no seu fork. Depois do merge, rode `git pull` em `~/viewport-safe` e `node scripts/install.mjs --user --force` para atualizar a sua instalação.

## Antes de mexer

1. **Abra uma issue** (modelo "Problema na skill") ou, se for pequeno, vá direto para o PR. A issue ajuda a registrar o caso mesmo que a correção demore.
2. **Reproduza.** Descreva o tamanho de janela, o componente ou a página, e o que o agente fez. Um relatório da auditoria (`report.md`) ou um print vale mais que uma descrição.

## Fluxo de trabalho

```bash
git clone https://github.com/rissardi1/viewport-safe.git
cd viewport-safe
git checkout -b minha-correcao
node .claude/skills/viewport-safe/scripts/doctor.mjs --setup
```

Faça a mudança em `.claude/skills/viewport-safe/` (é a única cópia da skill) e abra um **pull request** para a `main`. Não faça push direto na `main`.

## O que todo PR precisa ter

- [ ] `node .claude/skills/viewport-safe/scripts/doctor.mjs` termina com `All good`. No GitHub (Actions) roda sozinha a suíte de testes do lint, mais duas checagens rápidas, em todo PR. O `doctor` completo, com Chrome e auditoria, você roda na sua máquina.
- [ ] **Mudou uma regra, um lint (L1–L16) ou um check da auditoria (C1–C12)?** Acrescente um caso em `tests/lint-cases/` (um arquivo que deve falhar e um que deve passar) ou em `tests/fixtures/`. Sem teste, a regra volta a quebrar sem ninguém perceber.
- [ ] **Mudou `SKILL.md`?** Mantenha o texto curto. O que for detalhe vai para `references/`. Se criar uma regra nova, numere em sequência (hoje vai até a 15) e atualize o "Copy-paste patterns for rules 1-N" em `references/sizing-patterns.md`.
- [ ] **Mudou algo visual ou a auditoria?** Cole no PR a tabela de viewports (com `uw-half` primeiro) e diga em quais tamanhos você olhou o print.
- [ ] `CHANGELOG.md` atualizado, com a data e uma linha por mudança.
- [ ] Nada específico de um cliente: nomes, URLs, tokens. A config de cada site fica em `configs/` como modelo.

## Regras de ouro da skill

- **Não normalize o que você não mediu.** Uma correção deve citar o tamanho de janela onde o problema aparece e o número que mudou.
- **Auditoria limpa não prova que está certo** para canvas, WebGL e embeds. Olhe os prints de 1720x1280 e 1720x1440.
- **Windows e macOS.** O time usa os dois. Se a mudança mexe em caminho de arquivo, processo ou Chrome, diga em qual sistema você testou.
- **Compatibilidade:** a skill é para componentes novos e não deve depender de nenhum componente existente.

## Revisão

Quem mantém a skill revisa cada PR: o `doctor` passa, a mudança bate com as regras existentes e a documentação foi atualizada. O resultado fica registrado no histórico do PR.
