# Como contribuir com a viewport-safe

Achou um problema na skill ou quer melhorar algo? Ótimo. Este guia mostra o caminho para a correção entrar sem quebrar o que já funciona.

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
