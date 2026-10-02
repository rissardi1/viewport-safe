# viewport-safe

Uma skill para o Claude Code que faz componentes web (principalmente **Framer code components**) funcionarem em qualquer formato de janela, e não só no quadro de design de 1440x900.

O formato que mais quebra é o navegador **encaixado em metade de um monitor ultrawide** (cerca de 1720x1280), e também monitores com **1440px de altura**, ultrawides inteiros e notebooks baixos. A skill dá ao agente um fluxo de trabalho, um lint, e uma **auditoria** que abre o componente no Chrome em vários tamanhos, tira screenshots e aponta o que está cortado, vazio ou sobreposto.

> A skill é para **componentes e seções novos**. Ela não depende de nenhum componente existente.

---

## Requisitos

| Precisa de | Para quê |
|---|---|
| [Claude Code](https://claude.com/claude-code) | usar a skill |
| Node.js **22 ou mais novo** | lint e auditoria |
| Google Chrome ou Microsoft Edge | a auditoria abre o navegador |
| Git | clonar este repositório |
| As skills `framer` e `framer-code-components` | só se for trabalhar em projetos Framer. Vêm de `npx @framer/agent@latest setup`, rodado uma vez por máquina |

Funciona em Windows e macOS. Foi desenvolvida no Mac e depois corrigida e testada no Windows.

---

## Como instalar

### Opção A: clonar e trabalhar dentro do repositório (mais simples)

```bash
git clone https://github.com/rissardi1/viewport-safe.git viewport-safe
cd viewport-safe
node .claude/skills/viewport-safe/scripts/doctor.mjs --setup
```

O `doctor` confere Node, Chrome, instala as dependências da auditoria (cerca de 1 minuto) e roda os testes. No fim deve aparecer `All good. The skill is ready.`

Depois abra o Claude Code **nesta pasta** (`claude` no terminal, ou abra a pasta no app). Pronto: a skill, o `CLAUDE.md` e o hook de lint já estão no lugar.

### Opção B: instalar em uma pasta de trabalho que você já usa

```bash
node scripts/install.mjs --target "C:\caminho\da\sua\pasta"
```

Isso copia a skill para `<pasta>/.claude/skills/`, registra o hook em `<pasta>/.claude/settings.json`, acrescenta a seção ao `<pasta>/CLAUDE.md` (cria o arquivo se não existir) e instala as dependências. Pode rodar de novo sem medo: não duplica nada. Para atualizar a skill depois de um `git pull`, rode com `--force`.

### Opção C: para todas as sessões da sua conta

```bash
node scripts/install.mjs --user
```

Instala em `~/.claude/` (skill, hook e instruções). Vale para qualquer pasta em que você abrir o Claude Code.

Em qualquer opção, **reinicie o Claude Code** se ele já estava aberto, para ele ler o hook novo. Para conferir a instalação:

```bash
node <pasta-da-skill>/scripts/doctor.mjs
```

---

## Como usar no dia a dia

**Você não precisa acionar a skill.** Peça o componente normalmente ("crie um hero com vídeo", "ajuste essa seção que está cortada no ultrawide"). O `CLAUDE.md` instrui o agente a carregar a `viewport-safe` quando o pedido envolver componente de código, hero, seção em tela cheia, animação de rolagem, canvas, vídeo, embed ou altura de seção.

Três camadas trabalham juntas:

1. **Instrução (`CLAUDE.md`).** Faz o agente carregar a skill. Depende de o modelo obedecer; não é infalível.
2. **Hook de lint.** Cada vez que um arquivo `.tsx` que importa do `framer` é escrito ou editado, o lint roda sozinho e o resultado volta ao agente. Pega padrões como `100vh` com `overflow: hidden`, `font-size` em `vw`, `aspect-ratio` que cresce com a largura. Nunca bloqueia a edição.
3. **Auditoria com screenshots.** É a única que realmente testa as janelas. O agente deve rodá-la antes de dar algo como pronto.

> **Sinal de que a skill foi usada:** o agente termina a entrega com uma **tabela de viewports**, com a linha `uw-half` (meia tela do ultrawide) em primeiro lugar. Se a tabela não vier, cobre: *"rode a viewport-safe nisso"*.

### Comandos manuais

```bash
# lint de um ou mais arquivos
node .claude/skills/viewport-safe/scripts/lint-sizing.mjs MeuComponente.tsx

# auditoria de um componente (abre no harness local)
node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --component MeuComponente.tsx --matrix required

# auditoria de uma página publicada (preview do Framer, staging)
node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --url https://seu-preview.framer.app --matrix required
```

Os resultados (relatório e **folhas de comparação** com screenshots lado a lado) vão para a pasta `viewport-audit/`. **Abra as folhas e olhe.** Uma auditoria que passa não garante que está bom: ela não vê, por exemplo, texto sobre gradiente ou imagem, nem uma pilha de cards que desmonta.

### Tamanhos de janela testados

Os mesmos em todos os sites. Os monitores do time costumam ter **1440px de altura**, então três tamanhos com essa altura são obrigatórios:

| Id | Tamanho | O que representa |
|---|---|---|
| `uw-half` (principal) | 1720x1280 | ultrawide 34" encaixado em metade |
| `uw-half-stress` | 1720x1440 | metade do ultrawide na altura inteira |
| `uw-full-f11` | 3440x1440 | ultrawide na altura inteira |
| `qhd-1440` | 2560x1440 | monitor QHD 27" na altura inteira |
| `design` | 1440x900 | quadro de design do Framer |
| `uw-full`, `uw-29`, `qhd`, `fhd`, `laptop-125`, `mbp-14` | vários | ultrawide cheio, 29", QHD, Full HD, notebook a 125%, MacBook 14" |

A lista completa está em `.claude/skills/viewport-safe/scripts/viewports.json`. Os tamanhos são a área útil do navegador, não a resolução do monitor.

---

## Configuração por site (`viewport-safe.config.json`)

Cada site tem a sua grade. Esse arquivo diz à skill as regras de layout **do site para o qual você está criando componentes novos**, para eles já nascerem alinhados com o resto da página:

| Campo | O que é |
|---|---|
| `contentMaxWidth` | largura máxima da coluna de conteúdo (onde ficam textos e botões) |
| `displayTypeMax` | maior tamanho de título permitido, em px |
| `gutter` | margens laterais (mínima, máxima e a fluida) |
| `designFrame` | quadro de design, normalmente 1440x900 |
| `stagingUrl` | endereço de preview, usado na auditoria por URL |

O agente copia esses números para dentro do componente novo. A auditoria usa os mesmos para conferir.

**Para um site novo:**

1. Copie `configs/new-site.template.viewport-safe.config.json` para a pasta onde você trabalha, com o nome `viewport-safe.config.json`.
2. Ajuste os números. Se o site já está no ar, meça a coluna real:
   ```bash
   node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --url https://site-no-ar --measure
   ```
   Se o site ainda não existe, use a largura da grade do Figma.
3. Se você não criar a config, o agente **pergunta uma vez** (ou usa um padrão: títulos de até 120px e sem checagem de largura do conteúdo).

A skill procura a config subindo a partir da pasta do arquivo e da pasta atual. Para alternar entre sites, troque o arquivo ou passe `--config caminho/da-config.json`.

O molde fica em `configs/new-site.template.viewport-safe.config.json`. Quando a config de um site estiver pronta, vale guardá-la junto do projeto desse site, e não neste repositório.

---

## Limites conhecidos

- **Lint limpo não é prova.** Ele lê código, não renderiza. A auditoria e o olhar nos screenshots são parte do trabalho.
- **O acionamento automático não foi medido em condição limpa.** Em testes internos, o agente carregou a skill em cerca de 8 de 10 pedidos que deviam acioná-la, mas esses testes tinham contexto do projeto que outras pessoas não têm. Se a skill não for usada, peça explicitamente.
- A auditoria **não opina sobre texto sobre gradiente, imagem, vídeo ou canvas**, nem sobre texto dentro de SVG.
- O harness local não renderiza componentes que importam de `https://framer.com/m/...`. Nesse caso, publique um preview e use `--url`.
- A skill não foi testada de novo no macOS depois das correções feitas no Windows.
- Os tamanhos de meia tela são uma estimativa até alguém medir a janela real do monitor (bookmarklet: `javascript:alert(innerWidth+' x '+innerHeight+' @ '+devicePixelRatio+'x')`, e depois ajuste `uw-half` e `uw-full` em `viewports.json`).

---

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `Harness dependencies are missing` | `npm --prefix .claude/skills/viewport-safe/scripts/harness ci` (ou `doctor.mjs --setup`) |
| `No Chrome, Edge or Chromium found` | instale Chrome ou Edge, ou defina `CHROME_PATH` com o caminho do executável |
| O hook não avisa nada | reinicie o Claude Code; confira se há `.claude/settings.json` com o hook; o hook só reage a `.tsx`/`.jsx` que importam do `framer` |
| A skill não é carregada sozinha | peça: "use a skill viewport-safe". Confira se existe `CLAUDE.md` na pasta em que o Claude Code foi aberto |
| Aviso do npm `allow-scripts ... esbuild` na instalação | pode ignorar. É só um aviso de política do npm; a auditoria funciona normalmente |
| Erro `EBUSY` ou Chrome travado | atualize para a versão atual da skill (este erro foi corrigido); feche Chromes órfãos |

---

## O que há neste repositório

```
.claude/skills/viewport-safe/   a skill (SKILL.md, scripts, referências, testes)
.claude/settings.json           o hook de lint
CLAUDE.md                       instruções para o Claude Code
AGENTS.md                       as mesmas regras, resumidas, para o Codex e outros agentes
configs/                        molde de config para site novo
scripts/install.mjs             instala em outra pasta ou na conta do usuário
```

Para entender a skill por dentro, comece por `.claude/skills/viewport-safe/SKILL.md` e `README.md`.

---

## Contribuindo

Achou um problema ou tem uma correção? Veja o [CONTRIBUTING.md](CONTRIBUTING.md): abra uma issue (modelo "Problema na skill") ou um pull request. Os testes do lint rodam sozinhos em todo PR.
