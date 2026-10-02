# Changelog

## 2026-10-02 — fluxo de contribuição

- `CONTRIBUTING.md`, modelo de pull request, modelo de issue "Problema na skill" e workflow de GitHub Actions (`doctor.yml`) que roda a suíte de testes do lint e duas checagens rápidas em todo PR.

## 2026-10-02 — lições do ajuste do site da Collateral

Novo, vindo de uso real (flywheel e hero da home):

- **Regra 14** — uma seção com um visual travado na altura (hero com cena Unicorn/WebGL) pode ter a altura derivada da largura, com teto em `100svh`. Evita faixas de letterbox cortando brilho e listras da cena. Use uma razão um pouco abaixo da do design (1,55 para 1,6) para o quadro do design continuar com exatamente `100svh`.
- **Regra 15** — código de scale-to-fit só grava alturas já estabilizadas (debounce de ~450ms). Gravar o maior valor visto fazia a composição encolher na primeira rolagem, porque dois blocos de texto ficam abertos ao mesmo tempo durante a troca.
- **Passo 6 do fluxo** — para canvas, WebGL e embeds a auditoria não enxerga o conteúdo: o hero passou em todos os checks com o anel cortado. O print dos tamanhos 1720x1280 e 1720x1440 é a verificação.
- **`canvas-and-embeds.md` 4.2** — seção com aspecto travado, com medições reais; ressalva sobre faixas de letterbox. As seções seguintes foram renumeradas (4.3 a 4.5).
- **`framer-specifics.md` 14** — API do agente (DSL): réplicas herdam tudo do Desktop (incluindo `visible`), `aspectRatio` exige largura e altura fixas e só se limpa com `setAttributes`, `vw` em altura vira `vh`, máscaras, chaves `$control__` vêm do título do controle, controles de objeto aninhado não são graváveis.
- **`sizing-patterns.md` 6.9** — acompanhamento do caso da flywheel (título dentro do grupo escalado, latch estável, largura decide a escala) e quatro linhas novas na tabela de sintomas.

## 2026-09-29 — versão inicial validada

Lint L1–L16, auditoria C1–C12, harness, folhas de comparação, matriz de 11 viewports (inclui 3440x1440 e 2560x1440), correções de EBUSY e BOM no Windows.
